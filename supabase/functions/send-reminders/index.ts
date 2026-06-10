import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(value: string | null | undefined): string {
  return String(value || "").slice(0, 5);
}

async function sendBrevoEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Marcelo Pádel";

  if (!apiKey) throw new Error("Falta BREVO_API_KEY en Supabase Secrets");
  if (!senderEmail) throw new Error("Falta BREVO_SENDER_EMAIL en Supabase Secrets");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Brevo error:", result);
    throw new Error(result?.message || "Error enviando email con Brevo");
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const receivedSecret = req.headers.get("x-cron-secret");
    if (cronSecret && receivedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: bookings, error } = await supabase.rpc("get_pending_4h_email_reminders");
    if (error) throw error;

    let sent = 0;
    const failed: Array<{ bookingId: string; reason: string }> = [];

    for (const booking of bookings || []) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(booking.user_id);
        if (userError || !userData?.user?.email) {
          throw new Error(userError?.message || "Usuario sin email");
        }

        const email = userData.user.email;
        const userName = escapeHtml(booking.full_name || "Alumno");
        const date = escapeHtml(booking.booking_date);
        const dayName = escapeHtml(DAY_NAMES[booking.day_of_week] || "");
        const startTime = escapeHtml(formatTime(booking.start_time));
        const endTime = escapeHtml(formatTime(booking.end_time));
        const courtName = escapeHtml(booking.court_name || "Pista no indicada");
        const monitor = escapeHtml(booking.monitor || "Monitor no indicado");

        await sendBrevoEmail({
          to: email,
          subject: "Recordatorio: tu clase de pádel empieza en 4 horas",
          htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
              <h2>🎾 Tu clase empieza en 4 horas</h2>
              <p>Hola ${userName},</p>
              <p>Te recordamos que tienes una clase reservada hoy.</p>
              <p><strong>Día:</strong> ${dayName} ${date}</p>
              <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
              <p><strong>Pista:</strong> ${courtName}</p>
              <p><strong>Monitor:</strong> ${monitor}</p>
              <p>Si necesitas cancelar, entra en la web y revisa la política de cancelación.</p>
            </div>
          `,
          textContent: `Tu clase empieza en 4 horas\nHola ${userName}\nDía: ${dayName} ${date}\nHora: ${startTime}${endTime ? ` - ${endTime}` : ""}\nPista: ${courtName}\nMonitor: ${monitor}`,
        });

        await supabase
          .from("bookings")
          .update({ reminder_4h_sent_at: new Date().toISOString(), reminder_4h_email_error: null })
          .eq("id", booking.booking_id)
          .is("reminder_4h_sent_at", null);

        sent++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Error desconocido";
        failed.push({
          bookingId: booking.booking_id,
          reason,
        });

        await supabase
          .from("bookings")
          .update({ reminder_4h_email_error: reason })
          .eq("id", booking.booking_id);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: bookings?.length || 0, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-reminders error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

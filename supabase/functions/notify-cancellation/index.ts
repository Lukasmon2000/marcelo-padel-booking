import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId } = await req.json();
    if (!bookingId || typeof bookingId !== "string") {
      return new Response(JSON.stringify({ error: "bookingId requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, user_id, class_slot_id, booking_date, status, cancellation_email_sent_at")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) throw bookingError || new Error("Reserva no encontrada");

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isOwner = booking.user_id === user.id;
    const isAdmin = Boolean(roleRow);

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.status !== "cancelled") {
      return new Response(JSON.stringify({ error: "La reserva todavía no está cancelada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.cancellation_email_sent_at) {
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: slot }, { data: userData }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("user_id", booking.user_id).maybeSingle(),
      admin.from("class_slots").select("day_of_week, start_time, end_time, court_name").eq("id", booking.class_slot_id).maybeSingle(),
      admin.auth.admin.getUserById(booking.user_id),
    ]);

    const userEmail = userData?.user?.email;
    if (!userEmail) throw new Error("Usuario sin email");

    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const userName = escapeHtml(profile?.full_name || "Alumno");
    const date = escapeHtml(booking.booking_date);
    const dayName = escapeHtml(slot ? DAY_NAMES[slot.day_of_week] : "");
    const startTime = escapeHtml(formatTime(slot?.start_time));
    const endTime = escapeHtml(formatTime(slot?.end_time));
    const courtName = escapeHtml(slot?.court_name || "Pista no indicada");

    try {
      await sendBrevoEmail({
        to: userEmail,
        subject: "Reserva cancelada en Marcelo Pádel",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
            <h2>Reserva cancelada</h2>
            <p>Hola ${userName},</p>
            <p>Tu reserva ha sido cancelada correctamente.</p>
            <p><strong>Día:</strong> ${dayName} ${date}</p>
            <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
            <p><strong>Pista:</strong> ${courtName}</p>
          </div>
        `,
        textContent: `Reserva cancelada\nHola ${userName}\nDía: ${dayName} ${date}\nHora: ${startTime}${endTime ? ` - ${endTime}` : ""}\nPista: ${courtName}`,
      });

      if (adminEmail) {
        await sendBrevoEmail({
          to: adminEmail,
          subject: `Reserva cancelada - ${userName}`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
              <h2>Reserva cancelada</h2>
              <p><strong>Alumno:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
              <p><strong>Día:</strong> ${dayName} ${date}</p>
              <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
              <p><strong>Pista:</strong> ${courtName}</p>
            </div>
          `,
          textContent: `Reserva cancelada\nAlumno: ${userName}\nEmail: ${userEmail}\nDía: ${dayName} ${date}\nHora: ${startTime}${endTime ? ` - ${endTime}` : ""}\nPista: ${courtName}`,
        });
      }

      await admin
        .from("bookings")
        .update({ cancellation_email_sent_at: new Date().toISOString(), cancellation_email_error: null })
        .eq("id", bookingId);
    } catch (emailError) {
      await admin
        .from("bookings")
        .update({ cancellation_email_error: emailError instanceof Error ? emailError.message : "Error desconocido" })
        .eq("id", bookingId);
      throw emailError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-cancellation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

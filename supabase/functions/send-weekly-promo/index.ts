import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMadridNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    date: date.toISOString().slice(0, 10),
    dayOfWeek: date.getUTCDay(),
    hour,
    minute,
  };
}

function shouldSendNowMadrid(): boolean {
  const madridNow = getMadridNowParts();
  return madridNow.dayOfWeek === 1 && madridNow.hour === 9;
}

function getMadridWeekStart(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;

  date.setUTCDate(date.getUTCDate() - daysFromMonday);

  return date.toISOString().slice(0, 10);
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta ${name} en Supabase Secrets`);
  return value;
}

async function sendBrevoEmail({
  to,
  name,
  unsubscribeUrl,
}: {
  to: string;
  name: string;
  unsubscribeUrl: string;
}) {
  const apiKey = getEnv("BREVO_API_KEY");
  const senderEmail = getEnv("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Escuela de Pádel Marcelo Fernández";
  const appUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://marcelopadel.com";

  const safeName = escapeHtml(name || "jugador/a");

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #111827; line-height: 1.6;">
      <div style="background: #047857; color: white; padding: 22px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Nueva semana de pádel 🎾</h1>
        <p style="margin: 6px 0 0;">Escuela de Pádel Marcelo Fernández</p>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: 0; padding: 24px; border-radius: 0 0 12px 12px;">
        <p>Hola ${safeName},</p>

        <p>
          Empieza una nueva semana y ya puedes revisar los horarios disponibles para apuntarte a clase.
        </p>

        <p>
          Si quieres seguir mejorando tu nivel, entrenar con continuidad y no quedarte sin plaza,
          entra en la web y reserva la clase que mejor te venga.
        </p>

        <div style="margin: 28px 0;">
          <a href="${appUrl}"
             style="background: #059669; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Ver horarios y reservar
          </a>
        </div>

        <p>
          Nos vemos en pista.
        </p>

        <p style="font-size: 13px; color: #6b7280; margin-top: 28px;">
          Recibes este correo porque formas parte de la escuela.
          Si no quieres recibir mas emails de este tipo,
          <a href="${unsubscribeUrl}" style="color: #047857;">puedes darte de baja aquí</a>.
        </p>
      </div>
    </div>
  `;

  const textContent = `
Nueva semana de pádel

Hola ${name || "jugador/a"},

Ya puedes revisar los horarios disponibles para apuntarte a clase esta semana.

Reserva aquí:
${appUrl}

Si no quieres recibir mas emails de este tipo:
${unsubscribeUrl}
  `;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: to,
          name: name || to,
        },
      ],
      subject: "Nueva semana de pádel: reserva tu clase 🎾",
      htmlContent,
      textContent,
      tags: ["weekly-promo"],
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Brevo error:", result);
    throw new Error(result?.message || "Error enviando email semanal con Brevo");
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("unsubscribe_token");

    if (!token) {
      return new Response("Falta unsubscribe_token", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        marketing_emails_enabled: false,
        marketing_emails_unsubscribed_at: new Date().toISOString(),
      })
      .eq("marketing_unsubscribe_token", token);

    if (error) {
      return new Response("No se pudo procesar la baja", {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h2>Te has dado de baja correctamente</h2>
          <p>Ya no recibirás emails semanales de novedades y clases disponibles.</p>
        </body>
      </html>
      `,
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }

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

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    if (!force && !shouldSendNowMadrid()) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "outside_monday_09_madrid",
          madridNow: getMadridNowParts(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const weekStart = getMadridWeekStart();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, marketing_unsubscribe_token")
      .eq("marketing_emails_enabled", true)
      .is("marketing_emails_unsubscribed_at", null);

    if (profilesError) throw profilesError;

    let sent = 0;
    let skipped = 0;

    const failed: Array<{ userId: string; reason: string }> = [];

    for (const profile of profiles || []) {
      const { data: existingLog, error: logError } = await supabase
        .from("weekly_promo_email_logs")
        .select("id, sent_at")
        .eq("user_id", profile.user_id)
        .eq("week_start", weekStart)
        .not("sent_at", "is", null)
        .maybeSingle();

      if (logError) throw logError;

      if (existingLog?.sent_at) {
        skipped++;
        continue;
      }

      try {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(profile.user_id);

        if (userError || !userData?.user?.email) {
          throw new Error(userError?.message || "Usuario sin email");
        }

        const functionUrl = `${supabaseUrl}/functions/v1/send-weekly-promo`;
        const unsubscribeUrl = `${functionUrl}?unsubscribe_token=${profile.marketing_unsubscribe_token}`;

        await sendBrevoEmail({
          to: userData.user.email,
          name: profile.full_name || "Alumno",
          unsubscribeUrl,
        });

        await supabase.from("weekly_promo_email_logs").upsert(
          {
            user_id: profile.user_id,
            week_start: weekStart,
            sent_at: new Date().toISOString(),
            error: null,
          },
          {
            onConflict: "user_id,week_start",
          }
        );

        sent++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Error desconocido";

        failed.push({
          userId: profile.user_id,
          reason,
        });

        await supabase.from("weekly_promo_email_logs").upsert(
          {
            user_id: profile.user_id,
            week_start: weekStart,
            error: reason,
          },
          {
            onConflict: "user_id,week_start",
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        weekStart,
        checked: profiles?.length || 0,
        sent,
        skipped,
        failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-weekly-promo error:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

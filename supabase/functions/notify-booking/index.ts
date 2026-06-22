import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const GROUP_CLASS_CAP: Record<string, number> = {
  group_2: 2,
  group_4: 4,
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(value: string | null | undefined): string {
  return String(value || "").slice(0, 5);
}

function isGroupClass(classType: string | null | undefined): boolean {
  return classType === "group_2" || classType === "group_4";
}

function classTypeLabel(classType: string | null | undefined): string {
  if (classType === "group_2") return "Grupal 2 personas";
  if (classType === "group_4") return "Grupal 4 personas";
  if (classType === "private") return "Clase particular";
  return "Clase grupal";
}

function levelLabel(level: string | null | undefined): string {
  const labels: Record<string, string> = {
    iniciacion: "Iniciación",
    principiante: "Principiante",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
    profesional: "Profesional",
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
    Principiante: "Principiante",
    Intermedio: "Intermedio",
    Avanzado: "Avanzado",
  };

  if (!level) return "No indicado";
  return labels[level] || level;
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
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  let bookingId: string | null = null;

  try {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!adminEmail) throw new Error("Falta ADMIN_EMAIL en Supabase Secrets");

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

    const body = await req.json();
    bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, user_id, class_slot_id, booking_date, level, class_type, monitor, status, confirmation_email_sent_at, group_level_notification_sent_at")
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

    if (booking.status !== "confirmed") {
      return new Response(JSON.stringify({ error: "La reserva no está confirmada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const confirmationAlreadySent = Boolean(booking.confirmation_email_sent_at);
    const groupLevelNotificationAlreadySent = Boolean(booking.group_level_notification_sent_at);

    if (confirmationAlreadySent && (!isGroupClass(booking.class_type) || groupLevelNotificationAlreadySent)) {
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: profile }, { data: slot }, { data: userData }] = await Promise.all([
      admin.from("profiles").select("full_name, level").eq("user_id", booking.user_id).maybeSingle(),
      admin.from("class_slots").select("day_of_week, start_time, end_time, court_name, max_players").eq("id", booking.class_slot_id).maybeSingle(),
      admin.auth.admin.getUserById(booking.user_id),
    ]);

    const userEmail = userData?.user?.email;
    if (!userEmail) throw new Error("Usuario sin email");
    if (!slot) throw new Error("Clase no encontrada");

    const plainUserName = profile?.full_name || "Alumno";
    const rawLevel = booking.level || profile?.level;
    const userName = escapeHtml(plainUserName);
    const userLevel = escapeHtml(levelLabel(rawLevel));
    const date = escapeHtml(booking.booking_date);
    const dayName = escapeHtml(DAY_NAMES[slot.day_of_week] || "");
    const startTime = escapeHtml(formatTime(slot.start_time));
    const endTime = escapeHtml(formatTime(slot.end_time));
    const courtName = escapeHtml(slot.court_name || "Pista no indicada");
    const monitor = escapeHtml(booking.monitor || "Monitor no indicado");

    if (!confirmationAlreadySent) {
      try {
      await sendBrevoEmail({
        to: adminEmail,
        subject: `Nueva reserva - ${userName}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
            <h2 style="margin-bottom: 16px;">🎾 Nueva reserva en Marcelo Pádel</h2>
            <p><strong>Alumno:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
            <p><strong>Nivel:</strong> ${userLevel}</p>
            <p><strong>Día:</strong> ${dayName} ${date}</p>
            <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
            <p><strong>Pista:</strong> ${courtName}</p>
            <p><strong>Monitor:</strong> ${monitor}</p>
          </div>
        `,
        textContent: `Nueva reserva en Marcelo Pádel\nAlumno: ${userName}\nEmail: ${userEmail}\nNivel: ${userLevel}\nDía: ${dayName} ${date}\nHora: ${startTime}${endTime ? ` - ${endTime}` : ""}\nPista: ${courtName}\nMonitor: ${monitor}`,
      });

      await sendBrevoEmail({
        to: userEmail,
        subject: "Reserva confirmada en Marcelo Pádel",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
            <h2 style="margin-bottom: 16px;">🎾 Reserva confirmada</h2>
            <p>Hola ${userName},</p>
            <p>Tu reserva en Marcelo Pádel ha sido confirmada.</p>
            <p><strong>Día:</strong> ${dayName} ${date}</p>
            <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
            <p><strong>Nivel:</strong> ${userLevel}</p>
            <p><strong>Pista:</strong> ${courtName}</p>
            <p><strong>Monitor:</strong> ${monitor}</p>
            <p>Si necesitas cancelar la clase, entra en la web y cancélala desde tus reservas.</p>
          </div>
        `,
        textContent: `Reserva confirmada en Marcelo Pádel\nHola ${userName}\nDía: ${dayName} ${date}\nHora: ${startTime}${endTime ? ` - ${endTime}` : ""}\nNivel: ${userLevel}\nPista: ${courtName}\nMonitor: ${monitor}`,
      });

      await admin
        .from("bookings")
        .update({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null })
        .eq("id", bookingId);
      } catch (emailError) {
        await admin
          .from("bookings")
          .update({ confirmation_email_error: emailError instanceof Error ? emailError.message : "Error desconocido" })
          .eq("id", bookingId);
        throw emailError;
      }
    }

    let groupLevelNotificationsSent = 0;
    let groupLevelNotificationsFailed = 0;
    let groupLevelNotificationsSkipped: string | null = null;

    if (isGroupClass(booking.class_type) && !groupLevelNotificationAlreadySent) {
      try {
        if (!rawLevel) {
          groupLevelNotificationsSkipped = "missing_level";
        } else {
          const { count: confirmedCount, error: countError } = await admin
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("class_slot_id", booking.class_slot_id)
            .eq("booking_date", booking.booking_date)
            .eq("status", "confirmed");

          if (countError) throw countError;

          const capacity = GROUP_CLASS_CAP[booking.class_type] ?? slot.max_players ?? 4;
          const remainingSpots = Math.max(capacity - (confirmedCount || 0), 0);

          if (remainingSpots <= 0) {
            groupLevelNotificationsSkipped = "class_full";
          } else {
            const [{ data: alreadyBookedRows, error: alreadyBookedError }, { data: sameLevelProfiles, error: profilesError }] =
              await Promise.all([
                admin
                  .from("bookings")
                  .select("user_id")
                  .eq("class_slot_id", booking.class_slot_id)
                  .eq("booking_date", booking.booking_date)
                  .eq("status", "confirmed"),
                admin
                  .from("profiles")
                  .select("user_id, full_name")
                  .eq("level", rawLevel)
                  .eq("marketing_emails_enabled", true)
                  .is("marketing_emails_unsubscribed_at", null)
                  .neq("user_id", booking.user_id),
              ]);

            if (alreadyBookedError) throw alreadyBookedError;
            if (profilesError) throw profilesError;

            const alreadyBookedUserIds = new Set((alreadyBookedRows || []).map((row) => row.user_id));
            const recipients = (sameLevelProfiles || []).filter((profile) => !alreadyBookedUserIds.has(profile.user_id));

            if (recipients.length === 0) {
              groupLevelNotificationsSkipped = "no_recipients";
            } else {
              const appUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://marcelopadel.com";
              const safeAppUrl = escapeHtml(appUrl);
              const safeClassType = escapeHtml(classTypeLabel(booking.class_type));
              const remainingLabel = remainingSpots === 1 ? "1 plaza" : `${remainingSpots} plazas`;
              const plainLevel = levelLabel(rawLevel);
              const plainClassType = classTypeLabel(booking.class_type);
              const failed: Array<{ userId: string; reason: string }> = [];

              for (const peerProfile of recipients) {
                try {
                  const { data: peerUserData, error: peerUserError } =
                    await admin.auth.admin.getUserById(peerProfile.user_id);

                  if (peerUserError || !peerUserData?.user?.email) {
                    throw new Error(peerUserError?.message || "Usuario sin email");
                  }

                  const peerName = peerProfile.full_name || "Alumno";
                  const safePeerName = escapeHtml(peerName);

                  await sendBrevoEmail({
                    to: peerUserData.user.email,
                    subject: `Clase grupal de ${plainLevel} con plazas disponibles`,
                    htmlContent: `
                      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
                        <h2 style="margin-bottom: 16px;">Clase grupal de tu nivel</h2>
                        <p>Hola ${safePeerName},</p>
                        <p>${userName} ha reservado una clase grupal de nivel ${userLevel} y todavia quedan plazas disponibles.</p>
                        <p><strong>Tipo:</strong> ${safeClassType}</p>
                        <p><strong>Dia:</strong> ${dayName} ${date}</p>
                        <p><strong>Hora:</strong> ${startTime}${endTime ? ` - ${endTime}` : ""}</p>
                        <p><strong>Pista:</strong> ${courtName}</p>
                        <p><strong>Monitor:</strong> ${monitor}</p>
                        <p><strong>Plazas libres:</strong> ${escapeHtml(remainingLabel)}</p>
                        <p>
                          <a href="${safeAppUrl}" style="background: #059669; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                            Reservar mi plaza
                          </a>
                        </p>
                      </div>
                    `,
                    textContent: `Clase grupal de tu nivel\nHola ${peerName}\n${plainUserName} ha reservado una clase grupal de nivel ${plainLevel} y todavia quedan plazas disponibles.\nTipo: ${plainClassType}\nDia: ${DAY_NAMES[slot.day_of_week] || ""} ${booking.booking_date}\nHora: ${formatTime(slot.start_time)}${formatTime(slot.end_time) ? ` - ${formatTime(slot.end_time)}` : ""}\nPista: ${slot.court_name || "Pista no indicada"}\nMonitor: ${booking.monitor || "Monitor no indicado"}\nPlazas libres: ${remainingLabel}\nReservar: ${appUrl}`,
                  });

                  groupLevelNotificationsSent++;
                } catch (peerError) {
                  groupLevelNotificationsFailed++;
                  failed.push({
                    userId: peerProfile.user_id,
                    reason: peerError instanceof Error ? peerError.message : "Error desconocido",
                  });
                }
              }

              if (failed.length > 0) {
                const failedPreview = failed
                  .slice(0, 5)
                  .map((item) => `${item.userId}: ${item.reason}`)
                  .join("; ");
                await admin
                  .from("bookings")
                  .update({
                    group_level_notification_sent_at:
                      groupLevelNotificationsSent > 0 ? new Date().toISOString() : null,
                    group_level_notification_error: `Fallos ${failed.length}/${recipients.length}: ${failedPreview}`,
                  })
                  .eq("id", bookingId);
              } else {
                await admin
                  .from("bookings")
                  .update({
                    group_level_notification_sent_at: new Date().toISOString(),
                    group_level_notification_error: null,
                  })
                  .eq("id", bookingId);
              }
            }
          }
        }

        if (groupLevelNotificationsSkipped) {
          await admin
            .from("bookings")
            .update({
              group_level_notification_sent_at: new Date().toISOString(),
              group_level_notification_error: null,
            })
            .eq("id", bookingId);
        }
      } catch (notificationError) {
        groupLevelNotificationsFailed++;
        await admin
          .from("bookings")
          .update({
            group_level_notification_error: notificationError instanceof Error ? notificationError.message : "Error desconocido",
          })
          .eq("id", bookingId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      confirmationSent: !confirmationAlreadySent,
      confirmationAlreadySent,
      groupLevelNotificationsSent,
      groupLevelNotificationsFailed,
      groupLevelNotificationsSkipped,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-booking error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

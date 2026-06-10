import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLASS_TYPE_CAP: Record<string, number> = {
  group_2: 2,
  group_4: 4,
  private: 1,
};

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch active recurring bookings with slot info
    const { data: recurring, error: recErr } = await supabase
      .from("recurring_bookings")
      .select("*, class_slots(*)")
      .eq("is_active", true);

    if (recErr) throw recErr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const created: any[] = [];
    const skipped: any[] = [];

    // Generate bookings for the next 10 days
    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      const dow = (date.getDay() + 6) % 7; // Mon=0..Sun=6
      if (dow === 6) continue; // skip Sundays
      const dateStr = toLocalDateStr(date);

      for (const r of recurring || []) {
        const slot = (r as any).class_slots;
        if (!slot || slot.day_of_week !== dow || !slot.is_active) continue;

        // Check for existing booking
        const { data: existing } = await supabase
          .from("bookings")
          .select("id, user_id, level, class_type, status, monitor")
          .eq("class_slot_id", r.class_slot_id)
          .eq("booking_date", dateStr);

        const confirmed = (existing || []).filter((b: any) => b.status === "confirmed");

        if (confirmed.some((b: any) => b.user_id === r.user_id)) {
          skipped.push({ user_id: r.user_id, date: dateStr, reason: "already_booked" });
          continue;
        }

        const lockedLevel = confirmed[0]?.level || null;
        if (lockedLevel && lockedLevel !== r.level) {
          skipped.push({ user_id: r.user_id, date: dateStr, reason: "level_locked" });
          continue;
        }

        const existingType = confirmed[0]?.class_type || r.class_type;
        const cap = CLASS_TYPE_CAP[existingType] ?? 4;
        if (existingType === "private" && confirmed.length > 0) {
          skipped.push({ user_id: r.user_id, date: dateStr, reason: "private_taken" });
          continue;
        }
        if (confirmed.length >= cap) {
          skipped.push({ user_id: r.user_id, date: dateStr, reason: "full" });
          continue;
        }

        const monitor = confirmed[0]?.monitor || (r as any).monitor || null;

        const { error: insErr } = await supabase.from("bookings").insert({
          user_id: r.user_id,
          class_slot_id: r.class_slot_id,
          booking_date: dateStr,
          level: r.level,
          class_type: existingType,
          monitor,
          status: "confirmed",
        });

        if (insErr) {
          skipped.push({ user_id: r.user_id, date: dateStr, reason: insErr.message });
        } else {
          created.push({ user_id: r.user_id, date: dateStr });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, created: created.length, skipped: skipped.length, details: { created, skipped } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-recurring-bookings error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

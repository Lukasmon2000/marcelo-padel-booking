import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type ClassSlot,
  type Booking,
  type PlayerLevel,
  DAY_NAMES,
  getWeekDates,
  canBookDate,
  formatTime,
  LEVEL_LABELS,
  LEVEL_COLORS,
  LEVEL_BG_LIGHT,
} from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Users, Clock, ChevronLeft, ChevronRight, ListPlus, User, Users2, UsersRound, Pin, PinOff } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ClassType = "group_2" | "group_4" | "private";
type Monitor = "Lukas";

const MONITORS: Monitor[] = ["Lukas"];

const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  group_2: "Grupal 2 personas",
  group_4: "Grupal 4 personas",
  private: "Clase particular",
};

const CLASS_TYPE_CAP: Record<ClassType, number> = {
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

export function WeeklySchedule() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [pickerSlot, setPickerSlot] = useState<{ slot: ClassSlot; date: Date } | null>(null);
  const [pickerType, setPickerType] = useState<ClassType | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    // Sunday=0 → map to Monday-based (0=Mon..5=Sat), default 0 if Sunday
    return d === 0 ? 0 : d - 1 > 5 ? 0 : d - 1;
  });

  const weekDates = getWeekDates().map((d) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + weekOffset * 7);
    return nd;
  });

  // Month view: compute first Monday and last Saturday of the displayed month grid
  const monthRef = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const getMonthGridDates = (): Date[] => {
    const first = new Date(monthRef);
    const firstDow = first.getDay(); // 0=Sun..6=Sat
    const offsetToMon = (firstDow + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - offsetToMon);

    const last = new Date(monthRef);
    last.setMonth(last.getMonth() + 1);
    last.setDate(0);
    const lastDow = last.getDay();
    const offsetToSat = (6 - lastDow + 7) % 7;
    const gridEnd = new Date(last);
    gridEnd.setDate(last.getDate() + offsetToSat);

    const dates: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      if (cur.getDay() !== 0) dates.push(new Date(cur)); // skip Sundays
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const monthDates = viewMode === "month" ? getMonthGridDates() : [];

  useEffect(() => {
    fetchData();
  }, [weekOffset, monthOffset, viewMode, user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: slotsData } = await supabase
      .from("class_slots")
      .select("*")
      .eq("is_active", true)
      .order("start_time");

    if (slotsData) setSlots(slotsData);

    if (user) {
      const rangeDates = viewMode === "month" ? monthDates : weekDates;
      const startDate = toLocalDateStr(rangeDates[0]);
      const endDate = toLocalDateStr(rangeDates[rangeDates.length - 1]);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*")
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .eq("status", "confirmed");

      if (bookingsData) {
        const userIds = [...new Set(bookingsData.map((b) => b.user_id))];
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, is_minor")
            .in("user_id", userIds);
          const minorMap = new Map(profilesData?.map((p) => [p.user_id, p.is_minor]) || []);
          setBookings(bookingsData.map((b) => ({ ...b, is_minor: minorMap.get(b.user_id) || false })) as any);
        } else {
          setBookings(bookingsData);
        }
      }

      const { data: waitlistData } = await supabase
        .from("waitlist")
        .select("*")
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .eq("status", "waiting");
      if (waitlistData) setWaitlistEntries(waitlistData);

      const { data: recData } = await supabase
        .from("recurring_bookings")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (recData) setRecurring(recData);
    }
    setLoading(false);
  };

  const isRecurring = (slotId: string) => recurring.some((r) => r.class_slot_id === slotId);

  const toggleRecurring = async (slot: ClassSlot, classType: ClassType) => {
    if (!user || !profile) return;
    const existing = recurring.find((r) => r.class_slot_id === slot.id);
    if (existing) {
      await supabase.from("recurring_bookings").delete().eq("id", existing.id);
      toast.success("Reserva fija desactivada");
    } else {
      const { error } = await supabase.from("recurring_bookings").insert({
        user_id: user.id,
        class_slot_id: slot.id,
        class_type: classType,
        level: profile.level,
        is_active: true,
      });
      if (error) {
        toast.error("Error al crear reserva fija");
        return;
      }
      toast.success("📌 Reserva fija activada. Se reservará automáticamente esta franja cada semana.");
    }
    fetchData();
  };

  const getSlotBookings = (slotId: string, date: string) =>
    bookings.filter((b) => b.class_slot_id === slotId && b.booking_date === date && b.status === "confirmed");

  const getSlotLevel = (slotId: string, date: string): PlayerLevel | null => {
    const slotBookings = getSlotBookings(slotId, date);
    if (slotBookings.length === 0) return null;
    return (slotBookings[0].level as PlayerLevel) || null;
  };

  const getSlotClassType = (slotId: string, date: string): ClassType | null => {
    const slotBookings = getSlotBookings(slotId, date);
    if (slotBookings.length === 0) return null;
    return ((slotBookings[0] as any).class_type as ClassType) || "group_4";
  };

  const getSlotMonitor = (slotId: string, date: string): Monitor | null => {
    const slotBookings = getSlotBookings(slotId, date);
    if (slotBookings.length === 0) return null;
    return ((slotBookings[0] as any).monitor as Monitor) || null;
  };

  const getEffectiveCap = (slot: ClassSlot, slotId: string, date: string): number => {
    const type = getSlotClassType(slotId, date);
    if (type) return CLASS_TYPE_CAP[type];
    return slot.max_players;
  };

  const isUserBooked = (slotId: string, date: string) =>
    bookings.some(
      (b) => b.class_slot_id === slotId && b.booking_date === date && b.user_id === user?.id && b.status === "confirmed"
    );

  const isUserOnWaitlist = (slotId: string, date: string) =>
    waitlistEntries.some(
      (w) => w.class_slot_id === slotId && w.booking_date === date && w.user_id === user?.id
    );

  const getWaitlistCount = (slotId: string, date: string) =>
    waitlistEntries.filter((w) => w.class_slot_id === slotId && w.booking_date === date).length;

  const handleJoinWaitlist = async (slot: any, date: Date) => {
    if (!user) return;
    const dateStr = toLocalDateStr(date);
    const position = getWaitlistCount(slot.id, dateStr) + 1;
    const { error } = await supabase.from("waitlist").insert({
      user_id: user.id,
      class_slot_id: slot.id,
      booking_date: dateStr,
      position,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya estás en la lista de espera" : "Error al unirse");
    } else {
      toast.success(`Te has apuntado a la lista de espera (posición ${position})`);
      fetchData();
    }
  };

  const handleLeaveWaitlist = async (slotId: string, date: string) => {
    const entry = waitlistEntries.find(
      (w) => w.class_slot_id === slotId && w.booking_date === date && w.user_id === user?.id
    );
    if (!entry) return;
    await supabase.from("waitlist").delete().eq("id", entry.id);
    toast.success("Has salido de la lista de espera");
    fetchData();
  };

  const handleBook = async (slot: ClassSlot, date: Date) => {
    if (!user || !profile) return;

    const dateStr = toLocalDateStr(date);
    const lockedLevel = getSlotLevel(slot.id, dateStr);
    const slotBookings = getSlotBookings(slot.id, dateStr);
    const count = slotBookings.length;
    const existingType = getSlotClassType(slot.id, dateStr);

    if (lockedLevel && lockedLevel !== profile.level) {
      toast.error(`Esta clase ya está reservada para nivel ${LEVEL_LABELS[lockedLevel]}`);
      return;
    }

    if (!canBookDate(date, slot.start_time)) {
      toast.error("No puedes reservar esta clase (mínimo 4h de antelación, máximo 30 días)");
      return;
    }

    // First booker → choose class type + monitor
    if (count === 0 || !existingType) {
      setPickerSlot({ slot, date });
      setPickerType(null);
      return;
    }

    const cap = CLASS_TYPE_CAP[existingType];
    if (existingType === "private") {
      toast.error("Esta franja es una clase particular");
      return;
    }
    if (count >= cap) {
      toast.error("Clase completa");
      return;
    }

    // Inherit monitor from existing booking
    const existingMonitor = getSlotMonitor(slot.id, dateStr);
    await confirmBook(slot, date, existingType, existingMonitor);
  };

  const confirmBook = async (slot: ClassSlot, date: Date, classType: ClassType, monitor: Monitor | null) => {
    if (!user || !profile) return;
    const dateStr = toLocalDateStr(date);
    setBookingSlotId(slot.id);
    const { data: insertedBooking, error } = await supabase
      .from("bookings")
      .insert({
        class_slot_id: slot.id,
        user_id: user.id,
        booking_date: dateStr,
        level: profile.level,
        class_type: classType,
        monitor: monitor,
      } as any)
      .select("id")
      .single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya tienes esta reserva" : "Error al reservar");
    } else {
      toast.success(
        classType === "private"
          ? "¡Clase particular reservada!"
          : `¡Reservada! (${CLASS_TYPE_LABELS[classType]})`
      );
      const { error: emailError } = await supabase.functions.invoke("notify-booking", {
        body: {
          bookingId: insertedBooking?.id,
          userName: profile.full_name,
          userLevel: profile.level,
          date: dateStr,
          time: formatTime(slot.start_time),
          dayName: DAY_NAMES[slot.day_of_week],
          courtName: slot.court_name,
          monitor,
        },
      });

      if (emailError) {
        toast.warning("Reserva creada, pero no se pudo enviar el email de confirmación");
      }
      setPickerSlot(null);
      setPickerType(null);
      fetchData();
    }
    setBookingSlotId(null);
  };

  const handleCancel = async (slotId: string, date: string) => {
    const booking = bookings.find(
      (b) => b.class_slot_id === slotId && b.booking_date === date && b.user_id === user?.id
    );
    if (!booking) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (error) {
      toast.error("Error al cancelar");
    } else {
      const { error: emailError } = await supabase.functions.invoke("notify-cancellation", {
        body: { bookingId: booking.id },
      });

      if (emailError) {
        toast.warning("Reserva cancelada, pero no se pudo enviar el email de cancelación");
      } else {
        toast.success("Reserva cancelada");
      }

      fetchData();
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canGoBack = viewMode === "week" ? weekOffset > 0 : monthOffset > 0;
  const canGoForward = viewMode === "week" ? weekOffset < 4 : monthOffset < 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const renderDayColumn = (date: Date, dayIndex: number) => {
    const daySlots = slots.filter((s) => s.day_of_week === dayIndex);
    const isPast = date < today;
    const isToday = date.toDateString() === today.toDateString();

    return (
      <div
        key={dayIndex}
        className={`rounded-xl border transition-all ${
          isToday ? "border-primary bg-accent/50" : "border-border bg-card"
        } ${isPast ? "opacity-60" : ""}`}
      >
        {!isMobile && (
          <div
            className={`text-center py-2 px-1 rounded-t-xl font-heading text-sm font-semibold ${
              isToday ? "gradient-court text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <div>{DAY_NAMES[dayIndex]}</div>
            <div className="text-xs opacity-80">
              {date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            </div>
          </div>
        )}

        <div className={`p-2 space-y-2 ${isMobile ? "min-h-[120px]" : "min-h-[100px]"}`}>
          {daySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin clases</p>
          ) : (
            daySlots.map((slot) => {
              const dateStr = toLocalDateStr(date);
              const slotBookings = getSlotBookings(slot.id, dateStr);
              const count = slotBookings.length;
              const lockedLevel = getSlotLevel(slot.id, dateStr);
              const slotType = getSlotClassType(slot.id, dateStr);
              const effectiveCap = getEffectiveCap(slot, slot.id, dateStr);
              const booked = isUserBooked(slot.id, dateStr);
              const full = count >= effectiveCap;
              const isPrivate = slotType === "private";
              const canBook = canBookDate(date, slot.start_time) && !isPast && (!lockedLevel || lockedLevel === profile?.level);
              const onWaitlist = isUserOnWaitlist(slot.id, dateStr);
              const waitCount = getWaitlistCount(slot.id, dateStr);
              const canJoinWaitlist = full && !isPrivate && canBookDate(date, slot.start_time) && !isPast && !booked && (!lockedLevel || lockedLevel === profile?.level);

              return (
                <div
                  key={slot.id}
                  className={`rounded-lg p-2.5 border space-y-1.5 ${
                    booked
                      ? lockedLevel && LEVEL_BG_LIGHT[lockedLevel] ? LEVEL_BG_LIGHT[lockedLevel] : "border-primary bg-accent"
                      : lockedLevel && LEVEL_BG_LIGHT[lockedLevel]
                      ? `${LEVEL_BG_LIGHT[lockedLevel]} opacity-80`
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-foreground font-medium text-sm">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(slot.start_time)}
                    </div>
                    {lockedLevel && LEVEL_LABELS[lockedLevel] ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs px-2 py-0.5 ${LEVEL_COLORS[lockedLevel] || ""} text-primary-foreground`}
                      >
                        {LEVEL_LABELS[lockedLevel]?.slice(0, 4)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Libre</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {count}/{effectiveCap}
                    </div>
                    {slotType && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-foreground">
                        {slotType === "private" ? "Particular" : slotType === "group_2" ? "2 pers." : "4 pers."}
                      </span>
                    )}
                  </div>



                  {slotBookings.length > 0 && (
                    <div className="text-xs text-foreground/70 space-y-0.5">
                      {slotBookings.map((b) => (
                        <div key={b.id} className="truncate flex items-center gap-0.5">
                          {b.user_id === user?.id ? "✓ Tú" : "• Reservado"}
                          {(b as any).is_minor && (
                            <span className="text-[10px] bg-orange-200 text-orange-800 rounded px-1">Menor</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!isPast && (
                    <div>
                      {booked ? (
                        <div className="space-y-1.5">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full h-11 text-sm font-medium"
                            onClick={() => handleCancel(slot.id, dateStr)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            variant={isRecurring(slot.id) ? "secondary" : "outline"}
                            className="w-full h-9 text-xs"
                            onClick={() => toggleRecurring(slot, (slotType || "group_4") as ClassType)}
                          >
                            {isRecurring(slot.id) ? (
                              <>
                                <PinOff className="h-3.5 w-3.5 mr-1" />
                                Quitar fija
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5 mr-1" />
                                Hacer fija
                              </>
                            )}
                          </Button>
                        </div>
                      ) : full ? (
                        onWaitlist ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-11 text-sm"
                            onClick={() => handleLeaveWaitlist(slot.id, dateStr)}
                          >
                            En espera ✓
                          </Button>
                        ) : canJoinWaitlist ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full h-11 text-sm"
                            onClick={() => handleJoinWaitlist(slot, date)}
                          >
                            <ListPlus className="h-4 w-4 mr-1" />
                            Lista espera{waitCount > 0 ? ` (${waitCount})` : ""}
                          </Button>
                        ) : (
                          <div className="text-center text-muted-foreground font-medium py-2 text-sm">
                            Completa
                          </div>
                        )
                      ) : canBook ? (
                        <Button
                          size="sm"
                          className="w-full h-11 text-sm font-medium"
                          onClick={() => handleBook(slot, date)}
                          disabled={bookingSlotId === slot.id}
                        >
                          Reservar
                        </Button>
                      ) : (
                        <div className="text-center text-muted-foreground text-sm py-2">
                          {lockedLevel && lockedLevel !== profile?.level ? `Solo ${LEVEL_LABELS[lockedLevel]}` : "No disponible"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Helpers for month view
  const getDayDowMon = (date: Date) => {
    const d = date.getDay();
    return d === 0 ? 6 : d - 1; // Mon=0..Sun=6
  };
  const getDaySlots = (date: Date) =>
    slots.filter((s) => s.day_of_week === getDayDowMon(date));
  const monthLabel = monthRef.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode("week")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="h-11 w-11"
          onClick={() => (viewMode === "week" ? setWeekOffset((p) => p - 1) : setMonthOffset((p) => p - 1))}
          disabled={!canGoBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="font-heading font-semibold text-sm capitalize">
            {viewMode === "week"
              ? `${weekDates[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
              : monthLabel}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-11 w-11"
          onClick={() => (viewMode === "week" ? setWeekOffset((p) => p + 1) : setMonthOffset((p) => p + 1))}
          disabled={!canGoForward}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Level legend - scrollable on mobile */}
      <div className="flex items-center gap-3 text-xs overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 sm:justify-center">
        {(Object.entries(LEVEL_LABELS) as [PlayerLevel, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 shrink-0">
            <div className={`w-3 h-3 rounded-full ${LEVEL_COLORS[key]}`} />
            <span className="text-muted-foreground whitespace-nowrap">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-muted border border-border" />
          <span className="text-muted-foreground whitespace-nowrap">Libre</span>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-heading">No hay clases programadas</p>
        </div>
      ) : viewMode === "month" ? (
        /* Month view: Mon-Sat grid (no Sundays) */
        <div className="space-y-2">
          <div className="grid grid-cols-6 gap-1 text-center text-[11px] sm:text-xs font-heading font-semibold text-muted-foreground">
            {DAY_NAMES.slice(0, 6).map((d) => (
              <div key={d}>{d.slice(0, 3)}</div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            {monthDates.map((date, i) => {
              const dowMon = getDayDowMon(date);
              const dateStr = toLocalDateStr(date);
              const isPast = date < today;
              const isToday = date.toDateString() === today.toDateString();
              const inMonth = date.getMonth() === monthRef.getMonth();
              const daySlots = getDaySlots(date);
              const dayBookings = bookings.filter((b) => b.booking_date === dateStr && b.status === "confirmed");
              const userBooked = dayBookings.some((b) => b.user_id === user?.id);
              const levelsToday = Array.from(
                new Set(dayBookings.map((b) => b.level).filter(Boolean))
              ) as PlayerLevel[];
              const reservable = !isPast && canBookDate(date) && daySlots.length > 0;

              return (
                <button
                  key={i}
                  onClick={() => daySlots.length > 0 && setDayDetailDate(date)}
                  disabled={daySlots.length === 0}
                  className={`aspect-square sm:aspect-auto sm:min-h-[78px] rounded-lg border p-1 sm:p-2 text-left transition-all flex flex-col ${
                    !inMonth ? "opacity-40" : ""
                  } ${isPast ? "opacity-60 bg-muted/40" : "bg-card"} ${
                    isToday ? "border-primary border-2" : reservable ? "border-primary/40" : "border-border"
                  } ${userBooked ? "bg-accent" : ""} disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                      {date.getDate()}
                    </span>
                    {userBooked && <span className="text-[10px] text-primary">✓</span>}
                  </div>
                  {daySlots.length > 0 && (
                    <div className="mt-auto space-y-0.5">
                      <div className="hidden sm:block text-[10px] text-muted-foreground">
                        {daySlots.length} {daySlots.length === 1 ? "clase" : "clases"}
                      </div>
                      <div className="flex gap-0.5 flex-wrap">
                        {levelsToday.slice(0, 4).map((lv) => (
                          <div key={lv} className={`w-1.5 h-1.5 rounded-full ${LEVEL_COLORS[lv]}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : isMobile ? (
        /* Mobile week: day tabs + single day view */
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {weekDates.slice(0, 6).map((date, i) => {
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-1 min-w-[52px] py-2.5 px-1 rounded-lg text-center font-heading text-xs font-semibold transition-all ${
                    selectedDay === i
                      ? "gradient-court text-primary-foreground shadow-md"
                      : isToday
                      ? "bg-accent text-accent-foreground border border-primary"
                      : isPast
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div>{DAY_NAMES[i].slice(0, 3)}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    {date.toLocaleDateString("es-ES", { day: "numeric" })}
                  </div>
                </button>
              );
            })}
          </div>
          {renderDayColumn(weekDates[selectedDay], selectedDay)}
        </div>
      ) : (
        /* Desktop week: 6 column grid */
        <div className="grid grid-cols-6 gap-3">
          {weekDates.slice(0, 6).map((date, dayIndex) => renderDayColumn(date, dayIndex))}
        </div>
      )}

      {/* Day detail dialog (month view) */}
      <Dialog open={!!dayDetailDate} onOpenChange={(open) => !open && setDayDetailDate(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayDetailDate?.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </DialogTitle>
            <DialogDescription>Clases disponibles</DialogDescription>
          </DialogHeader>
          {dayDetailDate && renderDayColumn(dayDetailDate, getDayDowMon(dayDetailDate))}
        </DialogContent>
      </Dialog>

      {/* Class type picker dialog */}
      <Dialog open={!!pickerSlot} onOpenChange={(open) => { if (!open) { setPickerSlot(null); setPickerType(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elige el tipo de clase</DialogTitle>
            <DialogDescription>
              {pickerSlot && (
                <>
                  {DAY_NAMES[pickerSlot.slot.day_of_week]} · {formatTime(pickerSlot.slot.start_time)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(["group_2", "group_4", "private"] as ClassType[]).map((type) => {
              const Icon = type === "private" ? User : type === "group_2" ? Users2 : UsersRound;
              const desc =
                type === "private"
                  ? "Solo tú. Nadie más podrá apuntarse."
                  : type === "group_2"
                  ? "Máximo 2 personas. Se cierra al llegar a 2."
                  : "Máximo 4 personas.";
              return (
                <button
                  key={type}
                  onClick={() => pickerSlot && confirmBook(pickerSlot.slot, pickerSlot.date, type, "Lukas")}
                  disabled={bookingSlotId === pickerSlot?.slot.id}
                  className="w-full flex items-start gap-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors p-3 text-left disabled:opacity-50"
                >
                  <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-heading font-semibold text-sm text-foreground">
                      {CLASS_TYPE_LABELS[type]}
                    </div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

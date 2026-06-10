import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Trash2, Users } from "lucide-react";
import {
  type ClassSlot,
  type Booking,
  type PlayerLevel,
  DAY_NAMES,
  LEVEL_COLORS,
  LEVEL_LABELS,
  formatTime,
} from "@/lib/supabase-helpers";

type BookingExt = Booking & { profile_name?: string; is_minor?: boolean };

interface Props {
  slots: ClassSlot[];
  bookings: BookingExt[];
  onDeleteBooking: (id: string) => void;
}

// Local YYYY-MM-DD (no UTC conversions)
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const dow = date.getDay();
  date.setDate(date.getDate() - ((dow + 6) % 7));
  return date;
}

export function AdminBookingsCalendar({ slots, bookings, onDeleteBooking }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  const weekDates = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  // Unique time slots across the week, sorted
  const timeSlots = useMemo(() => {
    const set = new Set<string>();
    slots.forEach((s) => set.add(s.start_time.slice(0, 5)));
    return Array.from(set).sort();
  }, [slots]);

  // Map: dateISO -> time -> slots[] with bookings
  const grid = useMemo(() => {
    const map = new Map<string, Map<string, { slot: ClassSlot; bookings: BookingExt[] }[]>>();
    weekDates.forEach((date) => {
      const iso = toLocalISO(date);
      const dow = (date.getDay() + 6) % 7; // Mon=0
      const dayMap = new Map<string, { slot: ClassSlot; bookings: BookingExt[] }[]>();
      slots
        .filter((s) => s.day_of_week === dow)
        .forEach((slot) => {
          const t = slot.start_time.slice(0, 5);
          const slotBookings = bookings.filter(
            (b) => b.class_slot_id === slot.id && b.booking_date === iso
          );
          if (!dayMap.has(t)) dayMap.set(t, []);
          dayMap.get(t)!.push({ slot, bookings: slotBookings });
        });
      map.set(iso, dayMap);
    });
    return map;
  }, [weekDates, slots, bookings]);

  const totalThisWeek = useMemo(() => {
    let n = 0;
    grid.forEach((day) => day.forEach((arr) => arr.forEach((c) => (n += c.bookings.length))));
    return n;
  }, [grid]);

  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(getMonday(new Date()));

  const todayISO = toLocalISO(new Date());
  const rangeLabel = `${weekDates[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${weekDates[5].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg font-heading">Calendario de Reservas</CardTitle>
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" /> {totalThisWeek} esta semana
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} className="h-8 w-8 shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <span className="text-sm font-medium capitalize">{rangeLabel}</span>
            <Button variant="ghost" size="sm" onClick={goToday} className="h-7 text-xs">Hoy</Button>
          </div>
          <Button variant="outline" size="icon" onClick={goNext} className="h-8 w-8 shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {timeSlots.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No hay horarios configurados
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="min-w-[720px] px-2 sm:px-0">
              {/* Header row */}
              <div className="grid grid-cols-[60px_repeat(6,1fr)] gap-1 mb-1 sticky top-0 bg-card z-10">
                <div />
                {weekDates.map((d, i) => {
                  const iso = toLocalISO(d);
                  const isToday = iso === todayISO;
                  return (
                    <div
                      key={iso}
                      className={`text-center py-2 rounded-md text-xs font-medium ${
                        isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="font-heading">{DAY_NAMES[i].slice(0, 3)}</div>
                      <div className="text-[11px] opacity-80">{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Time rows */}
              {timeSlots.map((time) => (
                <div key={time} className="grid grid-cols-[60px_repeat(6,1fr)] gap-1 mb-1">
                  <div className="flex items-center justify-center text-[11px] font-mono text-muted-foreground bg-muted/50 rounded-md py-1">
                    {time}
                  </div>
                  {weekDates.map((d) => {
                    const iso = toLocalISO(d);
                    const cells = grid.get(iso)?.get(time) || [];
                    return (
                      <div
                        key={iso + time}
                        className="min-h-[56px] bg-muted/20 rounded-md p-1 space-y-1"
                      >
                        {cells.map(({ slot, bookings: cellBookings }) => {
                          const occupancy = cellBookings.length;
                          const max = slot.max_players;
                          const isFull = occupancy >= max;
                          const hasBookings = occupancy > 0;
                          return (
                            <div
                              key={slot.id}
                              className={`rounded-md p-1.5 text-[10px] border ${
                                hasBookings
                                  ? isFull
                                    ? "bg-destructive/10 border-destructive/40"
                                    : "bg-primary/5 border-primary/30"
                                  : "bg-card border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="font-semibold truncate">{slot.court_name}</span>
                                <Badge
                                  variant={isFull ? "destructive" : "secondary"}
                                  className="text-[9px] h-4 px-1 shrink-0"
                                >
                                  {occupancy}/{max}
                                </Badge>
                              </div>
                              {cellBookings.map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-center justify-between gap-1 py-0.5 group"
                                >
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    {b.level && (
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${LEVEL_COLORS[b.level as PlayerLevel]}`}
                                        title={LEVEL_LABELS[b.level as PlayerLevel]}
                                      />
                                    )}
                                    <span className="truncate text-foreground/90">
                                      {b.profile_name}
                                    </span>
                                    {b.is_minor && (
                                      <span className="text-[8px] text-orange-600 font-bold shrink-0">M</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => onDeleteBooking(b.id)}
                                    className="opacity-0 group-hover:opacity-100 sm:focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 shrink-0"
                                    aria-label="Cancelar reserva"
                                  >
                                    <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground">
          <span className="font-semibold">Niveles:</span>
          {(Object.keys(LEVEL_LABELS) as PlayerLevel[]).map((lvl) => (
            <div key={lvl} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${LEVEL_COLORS[lvl]}`} />
              <span>{LEVEL_LABELS[lvl]}</span>
            </div>
          ))}
          <span className="ml-auto">M = Menor · toca el ✕ para cancelar</span>
        </div>
      </CardContent>
    </Card>
  );
}

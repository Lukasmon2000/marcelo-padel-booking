import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DAY_NAMES, formatTime, LEVEL_LABELS, LEVEL_COLORS, type PlayerLevel } from "@/lib/supabase-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, Clock, MapPin, Bell, User, AlertTriangle, Info, Pin, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BookingWithSlot {
  id: string;
  booking_date: string;
  status: string;
  level: string | null;
  class_slots: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    court_name: string;
  };
}

const MIN_CANCEL_HOURS = 2;

function canCancelBooking(bookingDate: string, startTime: string): boolean {
  const [year, month, day] = bookingDate.split("-").map(Number);
  const [hours, minutes] = startTime.split(":").map(Number);
  const classDateTime = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();
  const diffMs = classDateTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= MIN_CANCEL_HOURS;
}

function getTimeUntilClass(bookingDate: string, startTime: string): string {
  const [year, month, day] = bookingDate.split("-").map(Number);
  const [hours, minutes] = startTime.split(":").map(Number);
  const classDateTime = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();
  const diffMs = classDateTime.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days}d ${diffHours % 24}h`;
  }
  return `${diffHours}h ${diffMins}m`;
}

export function MyBookings() {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithSlot[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchRecurring();
    }
  }, [user]);

  const fetchRecurring = async () => {
    const { data } = await supabase
      .from("recurring_bookings")
      .select("*, class_slots(day_of_week, start_time, end_time, court_name)")
      .eq("user_id", user!.id)
      .eq("is_active", true);
    if (data) setRecurring(data);
  };

  const removeRecurring = async (id: string) => {
    await supabase.from("recurring_bookings").delete().eq("id", id);
    toast.success("Reserva fija eliminada");
    fetchRecurring();
  };

  const fetchBookings = async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    const { data } = await supabase
      .from("bookings")
      .select("id, booking_date, status, level, class_slots(day_of_week, start_time, end_time, court_name)")
      .eq("user_id", user!.id)
      .eq("status", "confirmed")
      .gte("booking_date", todayStr)
      .order("booking_date");

    if (data) setBookings(data as unknown as BookingWithSlot[]);
    setLoading(false);
  };

  const handleCancel = async (bookingId: string, bookingDate: string, startTime: string) => {
    if (!canCancelBooking(bookingDate, startTime)) {
      toast.error(`No puedes cancelar con menos de ${MIN_CANCEL_HOURS} horas de antelación`);
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      toast.error("Error al cancelar");
    } else {
      const { error: emailError } = await supabase.functions.invoke("notify-cancellation", {
        body: { bookingId },
      });

      if (emailError) {
        toast.warning("Reserva cancelada, pero no se pudo enviar el email de cancelación");
      } else {
        toast.success("Reserva cancelada. Si había alguien en lista de espera, ocupará tu plaza automáticamente.");
      }

      fetchBookings();
    }
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />;
  }

  if (bookings.length === 0) {
    return (
      <div className="space-y-4">
        <CancellationPolicy />
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-heading font-medium">No tienes reservas próximas</p>
          <p className="text-sm mt-1">Reserva una clase en el horario semanal</p>
        </div>
      </div>
    );
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ty = tomorrow.getFullYear();
  const tm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const td = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowStr = `${ty}-${tm}-${td}`;
  const tomorrowBookings = bookings.filter((b) => b.booking_date === tomorrowStr);

  return (
    <div className="space-y-3">
      {/* Cancellation policy */}
      <CancellationPolicy />

      {/* User avatar header */}
      {profile && (
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12">
            {(profile as any).avatar_url ? (
              <AvatarImage src={(profile as any).avatar_url} alt={profile.full_name} />
            ) : null}
            <AvatarFallback className="gradient-court text-primary-foreground">
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-heading font-semibold text-foreground">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">Tus próximas clases</p>
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            <p className="font-heading font-semibold text-sm text-foreground">
              Mis reservas fijas
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estas franjas se reservan automáticamente cada semana cuando se abre el plazo.
          </p>
          <div className="space-y-1.5">
            {recurring.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2 text-sm">
                <span className="font-medium text-foreground">
                  {DAY_NAMES[r.class_slots.day_of_week]} · {formatTime(r.class_slots.start_time)} · {r.class_slots.court_name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeRecurring(r.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tomorrowBookings.length > 0 && (
        <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 flex items-start gap-3 animate-fade-in">
          <Bell className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-heading font-semibold text-yellow-800 text-sm">
              🔔 ¡Recordatorio! Mañana tienes {tomorrowBookings.length === 1 ? "una clase" : `${tomorrowBookings.length} clases`}
            </p>
            <ul className="text-xs text-yellow-700 mt-1 space-y-0.5">
              {tomorrowBookings.map((b) => (
                <li key={b.id}>
                  {DAY_NAMES[b.class_slots.day_of_week]} a las {formatTime(b.class_slots.start_time)} — {b.class_slots.court_name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {bookings.map((booking) => {
        const slot = booking.class_slots;
        const [year, month, day] = booking.booking_date.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const dayIndex = (date.getUTCDay() + 6) % 7;
        const level = booking.level as PlayerLevel | null;
        const canCancel = canCancelBooking(booking.booking_date, slot.start_time);
        const timeLeft = getTimeUntilClass(booking.booking_date, slot.start_time);

        return (
          <div
            key={booking.id}
            className="rounded-xl border border-border bg-card p-4 animate-fade-in space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold text-foreground">
                    {DAY_NAMES[dayIndex]}{" "}
                    {day} {date.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" })}
                  </span>
                  {level && (
                    <Badge
                      variant="secondary"
                      className={`${LEVEL_COLORS[level]} text-primary-foreground text-xs`}
                    >
                      {LEVEL_LABELS[level]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {slot.court_name}
                  </span>
                </div>
              </div>

              {canCancel ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vas a cancelar tu clase del{" "}
                        <strong>{DAY_NAMES[dayIndex]} {day}</strong> a las{" "}
                        <strong>{formatTime(slot.start_time)}</strong>.
                        {" "}Si hay alguien en lista de espera, ocupará tu plaza automáticamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Volver</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(booking.id, booking.booking_date, slot.start_time)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Sí, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <div className="text-right">
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    No cancelable
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Faltan {timeLeft}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CancellationPolicy() {
  return (
    <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-start gap-2.5">
      <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-0.5">Política de cancelación</p>
        <p>Puedes cancelar tu reserva hasta <strong>{MIN_CANCEL_HOURS} horas antes</strong> del inicio de la clase. Al cancelar, el siguiente alumno en lista de espera ocupará tu plaza automáticamente.</p>
      </div>
    </div>
  );
}

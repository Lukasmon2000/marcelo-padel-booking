import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type ClassSlot,
  type Booking,
  type Profile,
  type PlayerLevel,
  DAY_NAMES,
  LEVEL_LABELS,
  LEVEL_COLORS,
  formatTime,
} from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Calendar, UserCog, BarChart3, Megaphone, Search, UserX } from "lucide-react";
import { AdminStats } from "@/components/AdminStats";
import { AdminAnnouncements } from "@/components/AdminAnnouncements";
import { AdminBookingsCalendar } from "@/components/AdminBookingsCalendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TIME_SLOTS_MORNING = ["09:00", "10:00", "11:00", "12:00"];
const TIME_SLOTS_AFTERNOON = ["16:30", "17:30", "18:30", "19:30", "20:30"];
const ALL_TIMES = [...TIME_SLOTS_MORNING, ...TIME_SLOTS_AFTERNOON];

function endTime(start: string): string {
  const [h, m] = start.split(":").map(Number);
  const end = new Date(2000, 0, 1, h, m);
  end.setHours(end.getHours() + 1);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

interface SlotForm {
  day_of_week: number;
  start_time: string;
  court_name: string;
  max_players: number;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [bookings, setBookings] = useState<(Booking & { profile_name?: string; is_minor?: boolean })[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ClassSlot | null>(null);
  const [form, setForm] = useState<SlotForm>({
    day_of_week: 0,
    start_time: "09:00",
    court_name: "Pista 1",
    max_players: 4,
  });
  const [activeTab, setActiveTab] = useState<"slots" | "bookings" | "users" | "stats" | "announcements">("slots");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: slotsData } = await supabase
      .from("class_slots")
      .select("*")
      .order("day_of_week")
      .order("start_time");
    if (slotsData) setSlots(slotsData);

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "confirmed")
      .order("booking_date", { ascending: false });

    // Fetch all profiles (admin can see all)
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (profilesData) setProfiles(profilesData);

    if (bookingsData) {
      const profileMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);
      setBookings(
        bookingsData.map((b) => ({
          ...b,
          profile_name: profileMap.get(b.user_id)?.full_name || "Desconocido",
          is_minor: profileMap.get(b.user_id)?.is_minor || false,
        }))
      );
    }
    setLoading(false);
  };

  const handleSaveSlot = async () => {
    const end = endTime(form.start_time);
    if (editingSlot) {
      const { error } = await supabase
        .from("class_slots")
        .update({
          day_of_week: form.day_of_week,
          start_time: form.start_time,
          end_time: end,
          court_name: form.court_name,
          max_players: form.max_players,
        })
        .eq("id", editingSlot.id);
      if (error) {
        toast.error("Error al actualizar");
        return;
      }
      toast.success("Clase actualizada");
    } else {
      const { error } = await supabase.from("class_slots").insert({
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: end,
        court_name: form.court_name,
        max_players: form.max_players,
      });
      if (error) {
        toast.error("Error al crear clase");
        return;
      }
      toast.success("Clase creada");
    }
    setDialogOpen(false);
    setEditingSlot(null);
    fetchAll();
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm("¿Eliminar esta clase? Se cancelarán las reservas asociadas.")) return;
    const { error } = await supabase.from("class_slots").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Clase eliminada");
    fetchAll();
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("¿Cancelar esta reserva?")) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      toast.error("Error al cancelar reserva");
      return;
    }

    const { error: emailError } = await supabase.functions.invoke("notify-cancellation", {
      body: { bookingId: id },
    });

    if (emailError) {
      toast.warning("Reserva cancelada, pero no se pudo enviar el email de cancelación");
    } else {
      toast.success("Reserva cancelada");
    }

    fetchAll();
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeletingInProgress(true);
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { userId: deletingUser.user_id },
    });
    setDeletingInProgress(false);
    if (error || (data && (data as any).error)) {
      toast.error((data as any)?.error || error?.message || "Error al eliminar cuenta");
      return;
    }
    toast.success(`Cuenta de ${deletingUser.full_name || "alumno"} eliminada`);
    setDeletingUser(null);
    fetchAll();
  };

  const handleChangeLevel = async (userId: string, newLevel: PlayerLevel) => {
    setUpdatingUserId(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ level: newLevel })
      .eq("user_id", userId);
    if (error) {
      toast.error("Error al cambiar nivel");
    } else {
      toast.success("Nivel actualizado");
      fetchAll();
    }
    setUpdatingUserId(null);
  };

  const openEditDialog = (slot: ClassSlot) => {
    setEditingSlot(slot);
    setForm({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time.slice(0, 5),
      court_name: slot.court_name,
      max_players: slot.max_players,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSlot(null);
    setForm({ day_of_week: 0, start_time: "09:00", court_name: "Pista 1", max_players: 4 });
    setDialogOpen(true);
  };

  const getSlotName = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return "—";
    return `${DAY_NAMES[slot.day_of_week]} ${formatTime(slot.start_time)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
        <div className="flex gap-2 flex-nowrap">
        <Button
          variant={activeTab === "slots" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("slots")}
        >
          <Calendar className="h-4 w-4 mr-1" /> Horarios
        </Button>
        <Button
          variant={activeTab === "bookings" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("bookings")}
        >
          <Users className="h-4 w-4 mr-1" /> Reservas ({bookings.length})
        </Button>
        <Button
          variant={activeTab === "users" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("users")}
        >
          <UserCog className="h-4 w-4 mr-1" /> Alumnos ({profiles.length})
        </Button>
        <Button
          variant={activeTab === "stats" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("stats")}
        >
          <BarChart3 className="h-4 w-4 mr-1" /> Estadísticas
        </Button>
        <Button
          variant={activeTab === "announcements" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("announcements")}
        >
          <Megaphone className="h-4 w-4 mr-1" /> Avisos
        </Button>
        </div>
      </div>

      {activeTab === "slots" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-heading">Horarios de Clases</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-1" /> Nueva Clase
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSlot ? "Editar Clase" : "Nueva Clase"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Día</Label>
                    <Select
                      value={String(form.day_of_week)}
                      onValueChange={(v) => setForm((f) => ({ ...f, day_of_week: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.slice(0, 6).map((name, i) => (
                          <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hora de inicio</Label>
                    <Input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    />
                    {form.start_time && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fin: {endTime(form.start_time)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Pista</Label>
                    <Input
                      value={form.court_name}
                      onChange={(e) => setForm((f) => ({ ...f, court_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Máx. jugadores</Label>
                    <Select
                      value={String(form.max_players)}
                      onValueChange={(v) => setForm((f) => ({ ...f, max_players: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleSaveSlot}>
                    {editingSlot ? "Guardar cambios" : "Crear clase"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Pista</TableHead>
                    <TableHead>Máx.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">{DAY_NAMES[slot.day_of_week]}</TableCell>
                      <TableCell>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</TableCell>
                      <TableCell>{slot.court_name}</TableCell>
                      <TableCell>{slot.max_players}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(slot)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSlot(slot.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "bookings" && (
        <AdminBookingsCalendar
          slots={slots}
          bookings={bookings}
          onDeleteBooking={handleDeleteBooking}
        />
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg font-heading">Alumnos Registrados</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const q = userSearch.trim().toLowerCase();
              const filtered = q
                ? profiles.filter(
                    (p) =>
                      (p.full_name || "").toLowerCase().includes(q) ||
                      (p.phone || "").toLowerCase().includes(q)
                  )
                : profiles;
              return filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {q ? "No se encontraron alumnos" : "No hay alumnos registrados"}
                </p>
              ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Fecha registro</TableHead>
                      <TableHead>Cambiar Nivel</TableHead>
                      <TableHead className="text-right">Eliminar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.full_name || "Sin nombre"}
                          {(p as any).is_minor && (
                            <Badge variant="outline" className="ml-1.5 text-[9px] border-orange-400 text-orange-600">Menor</Badge>
                          )}
                        </TableCell>
                        <TableCell>{p.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`${LEVEL_COLORS[p.level]} text-primary-foreground text-[10px]`}>
                            {LEVEL_LABELS[p.level]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(p.created_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={p.level}
                            onValueChange={(v) => handleChangeLevel(p.user_id, v as PlayerLevel)}
                            disabled={updatingUserId === p.user_id}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(LEVEL_LABELS) as [PlayerLevel, string][]).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.user_id === user?.id ? (
                            <span className="text-[10px] text-muted-foreground">Tú</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingUser(p)}
                              aria-label="Eliminar cuenta"
                            >
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {activeTab === "stats" && <AdminStats />}

      {activeTab === "announcements" && <AdminAnnouncements />}

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta de {deletingUser?.full_name || "este alumno"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Se eliminará la cuenta del alumno junto con todas sus reservas,
              listas de espera y notificaciones. El alumno tendrá que volver a registrarse si quiere usar la app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingInProgress}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingInProgress}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingInProgress ? "Eliminando..." : "Sí, eliminar cuenta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

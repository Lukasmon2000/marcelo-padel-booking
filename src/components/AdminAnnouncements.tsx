import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export function AdminAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Rellena todos los campos");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      content: content.trim(),
      created_by: user!.id,
    });
    if (error) {
      toast.error("Error al crear aviso");
    } else {
      toast.success("Aviso publicado");
      setTitle("");
      setContent("");
      setDialogOpen(false);
      fetchAnnouncements();
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("announcements").update({ is_active: !isActive }).eq("id", id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este aviso?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    toast.success("Aviso eliminado");
    fetchAnnouncements();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-heading">Tablón de Avisos</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nuevo Aviso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Aviso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Clases canceladas mañana" />
              </div>
              <div className="space-y-2">
                <Label>Contenido</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Detalle del aviso..." rows={3} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving ? "Publicando..." : "Publicar aviso"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No hay avisos</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className={`rounded-lg border p-3 ${a.is_active ? "border-primary/30 bg-accent/30" : "border-border opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary shrink-0" />
                      <p className="font-semibold text-sm text-foreground">{a.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={() => handleToggle(a.id, a.is_active)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

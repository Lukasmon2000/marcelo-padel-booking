import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LEVEL_LABELS, type PlayerLevel } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Settings, Camera, User } from "lucide-react";

export function EditProfileDialog() {
  const { profile, user, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!profile || !user) return null;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
    setOpen(isOpen);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no puede superar 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Error al subir la imagen");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` })
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Error al actualizar perfil");
    } else {
      toast.success("Foto actualizada");
      await refreshProfile();
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Perfil actualizado");
      await refreshProfile();
      setOpen(false);
    }
    setSaving(false);
  };

  const avatarUrl = (profile as any).avatar_url;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Editar perfil">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-20 w-20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={profile.full_name} />
                ) : null}
                <AvatarFallback className="gradient-court text-primary-foreground text-xl">
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5">
                <Camera className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {uploading && <span className="text-xs text-muted-foreground">Subiendo...</span>}
          </div>

          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 123 456" />
          </div>

          <div className="space-y-2">
            <Label>Nivel</Label>
            <Input value={LEVEL_LABELS[profile.level]} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">El nivel solo puede ser modificado por el administrador</p>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

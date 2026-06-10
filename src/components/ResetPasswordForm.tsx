import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const prepareSession = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, document.title, "/reset-password");
        }

        const { data } = await supabase.auth.getSession();
        setHasSession(Boolean(data.session));
      } catch (error) {
        console.error("Error preparando recuperación:", error);
        setHasSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    prepareSession();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (cleanPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: cleanPassword,
      });

      if (error) throw error;

      toast.success("Contraseña actualizada correctamente.");

      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la contraseña. Solicita un nuevo enlace.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Comprobando enlace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="gradient-court rounded-t-xl p-8 text-center">
          <img
            src={logo}
            alt="Escuela de Pádel Marcelo Fernández"
            className="h-24 w-24 mx-auto mb-3 rounded-full"
          />

          <h1 className="text-2xl font-heading font-bold text-primary-foreground tracking-tight">
            Cambiar contraseña
          </h1>

          <p className="text-primary-foreground/80 text-sm font-heading">
            Escuela de Pádel Marcelo Fernández
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-b-xl p-8 shadow-lg border border-border space-y-4"
        >
          {!hasSession && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              El enlace no es válido o ha caducado. Vuelve a solicitar la recuperación de contraseña.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                disabled={!hasSession || loading}
                className="pr-24"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:underline"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Repetir contraseña</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              minLength={8}
              disabled={!hasSession || loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!hasSession || loading}
          >
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </Button>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full text-center text-sm text-primary font-medium hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    </div>
  );
}
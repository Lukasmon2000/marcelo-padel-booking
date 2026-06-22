import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LEVEL_LABELS, type PlayerLevel } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const SPANISH_PHONE_REGEX = /^[6789]\d{8}$/;

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("email rate limit exceeded")) {
    return "No se puede crear la cuenta ahora porque Supabase ha bloqueado temporalmente los emails de confirmación. Espera unos minutos o configura SMTP propio.";
  }

  if (
    message.includes("User already registered") ||
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "Ya existe una cuenta registrada con este correo.";
  }

  if (message.includes("Invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }

  if (message.includes("Email not confirmed")) {
    return "Tienes que confirmar tu correo antes de iniciar sesión.";
  }

  if (message.includes("Password should be at least")) {
    return "La contraseña es demasiado corta.";
  }

  if (message.includes("Unable to validate email address")) {
    return "El correo electrónico no parece válido.";
  }

  return message || "Error de autenticación.";
}

export function AuthForm() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState<PlayerLevel>("principiante");
  const [isMinor, setIsMinor] = useState(false);
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"hombre" | "mujer" | "">("");
  const [marketingEmailsEnabled, setMarketingEmailsEnabled] = useState(true);

  const levels = Object.entries(LEVEL_LABELS) as [PlayerLevel, string][];

  const validateForm = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanFullName = fullName.trim();
    const cleanPhone = phone.replace(/\s+/g, "");

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.error("Introduce un correo electrónico válido.");
      return null;
    }

    if (cleanPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return null;
    }

    if (isSignUp) {
      if (cleanFullName.length < 2) {
        toast.error("Introduce tu nombre completo.");
        return null;
      }

      if (!gender) {
        toast.error("Selecciona tu sexo.");
        return null;
      }

      if (!SPANISH_PHONE_REGEX.test(cleanPhone)) {
        toast.error("Introduce un teléfono válido de 9 dígitos.");
        return null;
      }
    }

    return {
      normalizedEmail,
      cleanPassword,
      cleanFullName,
      cleanPhone,
    };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validated = validateForm();
    if (!validated) return;

    const { normalizedEmail, cleanPassword, cleanFullName, cleanPhone } =
      validated;

    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(
          normalizedEmail,
          cleanPassword,
          cleanFullName,
          level,
          isMinor,
          cleanPhone,
          gender,
          marketingEmailsEnabled
        );

        toast.success("Cuenta creada correctamente.");
      } else {
        await signIn(normalizedEmail, cleanPassword);
        toast.success("Bienvenido de vuelta.");
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.error("Introduce tu correo electrónico para recuperar la contraseña.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      toast.success("Te hemos enviado un email para cambiar tu contraseña.");
      setForgotPasswordMode(false);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo enviar el email de recuperación. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMode = () => {
    setIsSignUp((current) => !current);
    setForgotPasswordMode(false);
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="gradient-court rounded-t-xl p-8 text-center">
        <img
          src={logo}
          alt="Escuela de Pádel Marcelo Fernández"
          className="h-24 w-24 mx-auto mb-3 rounded-full"
        />

        <h1 className="text-2xl font-heading font-bold text-primary-foreground tracking-tight">
          Escuela de Pádel
        </h1>

        <p className="text-primary-foreground/80 text-sm font-heading">
          Marcelo Fernández
        </p>

        <p className="text-primary-foreground/60 mt-2 text-xs">
          {forgotPasswordMode
            ? "Recupera el acceso a tu cuenta"
            : isSignUp
              ? "Crea tu cuenta y reserva clases"
              : "¡Vamos a subir tu nivel de pádel! 🚀"}
        </p>
      </div>

      {forgotPasswordMode ? (
        <form
          onSubmit={handleForgotPassword}
          className="bg-card rounded-b-xl p-8 shadow-lg border border-border space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="recovery-email">Correo electrónico</Label>
            <Input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail(email.trim().toLowerCase())}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Enviando..." : "Enviar enlace de recuperación"}
          </Button>

          <button
            type="button"
            onClick={() => setForgotPasswordMode(false)}
            className="w-full text-center text-sm text-primary font-medium hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-b-xl p-8 shadow-lg border border-border space-y-4"
        >
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => setFullName(fullName.trim())}
                placeholder="Tu nombre completo"
                required
                autoComplete="name"
              />
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label>Sexo</Label>

              <div className="grid grid-cols-2 gap-2">
                {([
                  ["hombre", "Hombre"],
                  ["mujer", "Mujer"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGender(value)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                      gender === value
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="600000000"
                required
                maxLength={15}
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                Debe tener 9 dígitos. Ejemplo: 600000000.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail(email.trim().toLowerCase())}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
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

          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setForgotPasswordMode(true)}
                className="text-sm text-primary font-medium hover:underline"
              >
                He olvidado mi contraseña
              </button>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label>Tu nivel de pádel</Label>

              <div className="grid grid-cols-3 gap-2">
                {levels.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLevel(value)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                      level === value
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSignUp && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_minor"
                checked={isMinor}
                onCheckedChange={(checked) => setIsMinor(checked === true)}
              />

              <Label
                htmlFor="is_minor"
                className="text-sm font-normal cursor-pointer"
              >
                Soy menor de edad
              </Label>
            </div>
          )}

          {isSignUp && (
            <div className="flex items-start space-x-2">
              <Checkbox
                id="marketing_emails"
                checked={marketingEmailsEnabled}
                onCheckedChange={(checked) =>
                  setMarketingEmailsEnabled(checked === true)
                }
              />

              <Label
                htmlFor="marketing_emails"
                className="text-sm font-normal cursor-pointer leading-relaxed"
              >
                Quiero recibir avisos y novedades sobre clases disponibles,
                horarios y actividades de la escuela.
              </Label>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading
              ? "Cargando..."
              : isSignUp
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={handleChangeMode}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Inicia sesión" : "Regístrate"}
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

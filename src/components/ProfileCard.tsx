import { useAuth } from "@/hooks/useAuth";
import { LEVEL_LABELS, LEVEL_COLORS } from "@/lib/supabase-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EditProfileDialog } from "@/components/EditProfileDialog";
import { LogOut, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function ProfileCard() {
  const { profile, user, signOut } = useAuth();
  const isMobile = useIsMobile();

  if (!profile || !user) return null;

  const avatarUrl = (profile as any).avatar_url;

  if (isMobile) {
    return (
      <div className="flex items-center gap-0.5">
        <Avatar className="h-8 w-8 ring-1 ring-primary-foreground/30">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile.full_name} /> : null}
          <AvatarFallback className={`${LEVEL_COLORS[profile.level]} text-primary-foreground text-xs`}>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <EditProfileDialog />
        <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión" className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={profile.full_name} />
          ) : null}
          <AvatarFallback className="gradient-court text-primary-foreground">
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-heading font-semibold text-foreground text-sm">
            {profile.full_name || user.email}
          </p>
          <Badge
            variant="secondary"
            className={`${LEVEL_COLORS[profile.level]} text-primary-foreground text-xs mt-0.5`}
          >
            {LEVEL_LABELS[profile.level]}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <EditProfileDialog />
        <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

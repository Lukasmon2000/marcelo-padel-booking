import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id, title, content, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setAnnouncements(data);
      });
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border-2 border-primary/30 bg-accent/60 p-4 flex items-start gap-3 animate-fade-in"
        >
          <Megaphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-foreground text-sm">{a.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{a.content}</p>
          </div>
          <button onClick={() => setDismissed((s) => new Set(s).add(a.id))} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import { WeeklySchedule } from "@/components/WeeklySchedule";
import { MyBookings } from "@/components/MyBookings";
import { ProfileCard } from "@/components/ProfileCard";
import { AdminPanel } from "@/components/AdminPanel";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { StatsPanel } from "@/components/StatsPanel";
import { NotificationBell } from "@/components/NotificationBell";
import { CalendarDays, BookOpen, Shield, BarChart3 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@/assets/logo.png";

const Index = () => {
  const { user, loading, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("schedule");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AuthForm />
      </div>
    );
  }

  const tabs = [
    { id: "schedule", label: "Horario", icon: CalendarDays },
    { id: "bookings", label: "Reservas", icon: BookOpen },
    { id: "stats", label: "Stats", icon: BarChart3 },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="gradient-court safe-area-top">
        <div className="container max-w-6xl py-3 px-3 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img src={logo} alt="Logo" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-heading font-bold text-primary-foreground tracking-tight leading-tight truncate">
                  Escuela de Pádel
                </h1>
                <p className="text-[10px] sm:text-xs text-primary-foreground/70 font-heading truncate">Marcelo Fernández</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <NotificationBell />
              <ProfileCard />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`container max-w-6xl flex-1 py-4 px-4 min-w-0 overflow-x-hidden ${isMobile ? "pb-24" : "py-6"}`}>
        <AnnouncementsBanner />

        {/* Desktop tabs */}
        {!isMobile && (
          <div className={`grid w-full max-w-lg mx-auto mb-6 ${isAdmin ? "grid-cols-4" : "grid-cols-3"} bg-muted rounded-lg p-1`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <div className="animate-fade-in min-w-0">
          {activeTab === "schedule" && <WeeklySchedule />}
          {activeTab === "bookings" && <MyBookings />}
          {activeTab === "stats" && <StatsPanel />}
          {activeTab === "admin" && isAdmin && <AdminPanel />}
        </div>
      </main>

      {/* Footer - hidden on mobile */}
      {!isMobile && (
        <footer className="border-t border-border py-4 mt-8">
          <div className="container max-w-6xl px-4 flex items-center justify-center gap-3">
            <span className="text-xs text-muted-foreground">Escuela de Pádel Marcelo Fernández</span>
          </div>
        </footer>
      )}

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom z-50">
          <div className="flex items-stretch">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? "text-primary" : ""}`} />
                <span className="text-[11px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Index;

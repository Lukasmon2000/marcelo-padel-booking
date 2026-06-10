import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_NAMES, LEVEL_LABELS, type PlayerLevel } from "@/lib/supabase-helpers";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Flame, Calendar, Trophy, Target } from "lucide-react";

interface MonthlyData {
  month: string;
  classes: number;
}

export function StatsPanel() {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [thisMonth, setThisMonth] = useState(0);
  const [thisQuarter, setThisQuarter] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_date")
      .eq("user_id", user!.id)
      .eq("status", "confirmed")
      .lte("booking_date", todayStr)
      .order("booking_date", { ascending: false });

    if (!bookings) {
      setLoading(false);
      return;
    }

    setTotalClasses(bookings.length);

    // This month
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthCount = bookings.filter((b) => b.booking_date.startsWith(currentMonthKey)).length;
    setThisMonth(thisMonthCount);

    // This quarter
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    const quarterMonths = [0, 1, 2].map((i) => {
      const m = quarterStart + i + 1;
      return `${now.getFullYear()}-${String(m).padStart(2, "0")}`;
    });
    const thisQuarterCount = bookings.filter((b) => quarterMonths.some((qm) => b.booking_date.startsWith(qm))).length;
    setThisQuarter(thisQuarterCount);

    // Monthly data (last 6 months)
    const months: Record<string, number> = {};
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = 0;
    }
    bookings.forEach((b) => {
      const key = b.booking_date.slice(0, 7);
      if (key in months) months[key]++;
    });
    setMonthlyData(
      Object.entries(months).map(([key, count]) => ({
        month: monthNames[parseInt(key.split("-")[1]) - 1],
        classes: count,
      }))
    );

    // Streak: consecutive weeks with at least one class
    let currentStreak = 0;
    const getWeekKey = (d: Date) => {
      const start = new Date(d);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday-based
      return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    };
    const weekSet = new Set(bookings.map((b) => {
      const [y, m, d] = b.booking_date.split("-").map(Number);
      return getWeekKey(new Date(y, m - 1, d));
    }));
    for (let w = 0; w < 52; w++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() - w * 7);
      if (weekSet.has(getWeekKey(checkDate))) {
        currentStreak++;
      } else {
        break;
      }
    }
    setStreak(currentStreak);
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />;
  }

  const streakMessage =
    streak >= 8 ? "🏆 ¡Increíble constancia!" :
    streak >= 4 ? "🔥 ¡Gran racha, sigue así!" :
    streak >= 2 ? "💪 ¡Buen ritmo!" :
    streak === 1 ? "👍 ¡Empezando bien!" :
    "🎾 ¡Reserva tu primera clase!";

  return (
    <div className="space-y-4">
      {/* Streak banner */}
      {streak > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 p-4 flex items-center gap-3">
          <div className="text-3xl">
            {streak >= 8 ? "🏆" : streak >= 4 ? "🔥" : "💪"}
          </div>
          <div>
            <p className="font-heading font-bold text-foreground">
              {streak} {streak === 1 ? "semana" : "semanas"} consecutivas
            </p>
            <p className="text-xs text-muted-foreground">{streakMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Calendar className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{thisMonth}</p>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Target className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{thisQuarter}</p>
            <p className="text-xs text-muted-foreground">Este trimestre</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Flame className="h-6 w-6 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{streak}</p>
            <p className="text-xs text-muted-foreground">Semanas racha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Trophy className="h-6 w-6 mx-auto text-accent-foreground mb-1" />
            <p className="text-2xl font-heading font-bold text-foreground">{totalClasses}</p>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Clases por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={20} />
                <Tooltip />
                <Bar dataKey="classes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Clases" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

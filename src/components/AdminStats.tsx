import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAY_NAMES, LEVEL_LABELS, formatTime, type PlayerLevel } from "@/lib/supabase-helpers";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Calendar, TrendingUp } from "lucide-react";

const COLORS = ["hsl(130, 60%, 40%)", "hsl(45, 90%, 50%)", "hsl(0, 70%, 50%)"];

export function AdminStats() {
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [dayData, setDayData] = useState<{ day: string; bookings: number }[]>([]);
  const [levelData, setLevelData] = useState<{ name: string; value: number }[]>([]);
  const [topStudents, setTopStudents] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    const [{ data: profiles }, { data: bookings }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, level"),
      supabase.from("bookings").select("user_id, booking_date, class_slot_id, level").eq("status", "confirmed"),
    ]);

    if (!profiles || !bookings) {
      setLoading(false);
      return;
    }

    setTotalStudents(profiles.length);
    setTotalBookings(bookings.length);

    // Bookings by day of week
    const { data: slots } = await supabase.from("class_slots").select("id, day_of_week");
    const slotDayMap = new Map(slots?.map((s) => [s.id, s.day_of_week]) || []);
    const dayCounts: Record<number, number> = {};
    bookings.forEach((b) => {
      const day = slotDayMap.get(b.class_slot_id);
      if (day !== undefined) dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    setDayData(
      DAY_NAMES.slice(0, 6).map((name, i) => ({
        day: name.slice(0, 3),
        bookings: dayCounts[i] || 0,
      }))
    );

    // Level distribution
    const levelCounts: Record<string, number> = {};
    profiles.forEach((p) => {
      const label = LEVEL_LABELS[p.level as PlayerLevel] || p.level;
      levelCounts[label] = (levelCounts[label] || 0) + 1;
    });
    setLevelData(Object.entries(levelCounts).map(([name, value]) => ({ name, value })));

    // Top students
    const studentCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      studentCounts[b.user_id] = (studentCounts[b.user_id] || 0) + 1;
    });
    const profileMap = new Map(profiles.map((p) => [p.user_id, p.full_name || "Sin nombre"]));
    const sorted = Object.entries(studentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([uid, count]) => ({ name: profileMap.get(uid) || "—", count }));
    setTopStudents(sorted);

    setLoading(false);
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-heading font-bold">{totalStudents}</p>
            <p className="text-xs text-muted-foreground">Alumnos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Calendar className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-heading font-bold">{totalBookings}</p>
            <p className="text-xs text-muted-foreground">Reservas totales</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Reservas por día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={20} />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="hsl(160, 70%, 36%)" radius={[4, 4, 0, 0]} name="Reservas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">Distribución por nivel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={levelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {levelData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">🏆 Alumnos más activos</CardTitle>
        </CardHeader>
        <CardContent>
          {topStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin datos aún</p>
          ) : (
            <div className="space-y-2">
              {topStudents.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {s.name}
                  </span>
                  <span className="text-muted-foreground">{s.count} clases</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

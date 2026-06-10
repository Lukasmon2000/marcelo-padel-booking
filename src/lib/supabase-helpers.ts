import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PlayerLevel = Database["public"]["Enums"]["player_level"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ClassSlot = Database["public"]["Tables"]["class_slots"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];

export const LEVEL_LABELS: Record<PlayerLevel, string> = {
  iniciacion: "Iniciación",
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

export const LEVEL_COLORS: Record<PlayerLevel, string> = {
  iniciacion: "bg-level-initiation",
  principiante: "bg-level-beginner",
  intermedio: "bg-level-intermediate",
  avanzado: "bg-level-advanced",
};

export const LEVEL_BG_LIGHT: Record<PlayerLevel, string> = {
  iniciacion: "bg-blue-100 border-blue-400",
  principiante: "bg-green-100 border-green-400",
  intermedio: "bg-yellow-100 border-yellow-400",
  avanzado: "bg-red-100 border-red-400",
};

export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function getWeekDates(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function getNextWeekDates(): Date[] {
  const dates = getWeekDates();
  return dates.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 7);
    return next;
  });
}

export function canBookDate(date: Date, slotTime?: string): boolean {
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(now.getDate() + 30);
  maxDate.setHours(23, 59, 59, 999);

  // Date must be within the next 10 days
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (startOfDate < todayStart || startOfDate > maxDate) return false;

  // For today, require at least 4 hours before class start
  if (startOfDate.getTime() === todayStart.getTime() && slotTime) {
    const [h, m] = slotTime.split(":").map(Number);
    const classStart = new Date(date);
    classStart.setHours(h, m, 0, 0);
    const minTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    if (classStart < minTime) return false;
  }

  return true;
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

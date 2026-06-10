-- Campos y permisos necesarios para automatizar correos transaccionales.
-- No elimina datos existentes y se puede aplicar sobre una base ya en producción.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_error text,
  ADD COLUMN IF NOT EXISTS cancellation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_email_error text,
  ADD COLUMN IF NOT EXISTS reminder_4h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_4h_email_error text,
  ADD COLUMN IF NOT EXISTS reminder_tomorrow_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_tomorrow_email_error text,
  ADD COLUMN IF NOT EXISTS daily_summary_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS daily_summary_email_error text;

CREATE INDEX IF NOT EXISTS idx_bookings_pending_4h_reminders
ON public.bookings (booking_date, class_slot_id)
WHERE status = 'confirmed' AND reminder_4h_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_pending_tomorrow_reminders
ON public.bookings (booking_date, class_slot_id)
WHERE status = 'confirmed' AND daily_summary_sent_at IS NULL;

-- El panel de administrador debe cancelar reservas con UPDATE status='cancelled', no con DELETE.
-- Esta política permite esa operación sin romper el trigger de lista de espera.
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
CREATE POLICY "Admins can update bookings"
ON public.bookings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reservas que empiezan aproximadamente dentro de 4 horas.
-- La ventana de 15 minutos permite ejecutar el cron cada 10-15 minutos sin duplicados.
CREATE OR REPLACE FUNCTION public.get_pending_4h_email_reminders()
RETURNS TABLE (
  booking_id uuid,
  user_id uuid,
  booking_date date,
  level public.player_level,
  class_type text,
  monitor text,
  full_name text,
  start_time time,
  end_time time,
  court_name text,
  day_of_week integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id AS booking_id,
    b.user_id,
    b.booking_date,
    b.level,
    b.class_type,
    b.monitor,
    p.full_name,
    cs.start_time,
    cs.end_time,
    cs.court_name,
    cs.day_of_week
  FROM public.bookings b
  JOIN public.class_slots cs ON cs.id = b.class_slot_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  WHERE b.status = 'confirmed'
    AND b.reminder_4h_sent_at IS NULL
    AND ((b.booking_date + cs.start_time) AT TIME ZONE 'Europe/Madrid') >= now() + interval '235 minutes'
    AND ((b.booking_date + cs.start_time) AT TIME ZONE 'Europe/Madrid') <  now() + interval '250 minutes';
$$;

-- Reservas del día actual para el resumen de la mañana.
CREATE OR REPLACE FUNCTION public.get_pending_today_email_summaries()
RETURNS TABLE (
  booking_id uuid,
  user_id uuid,
  booking_date date,
  level public.player_level,
  class_type text,
  monitor text,
  full_name text,
  start_time time,
  end_time time,
  court_name text,
  day_of_week integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id AS booking_id,
    b.user_id,
    b.booking_date,
    b.level,
    b.class_type,
    b.monitor,
    p.full_name,
    cs.start_time,
    cs.end_time,
    cs.court_name,
    cs.day_of_week
  FROM public.bookings b
  JOIN public.class_slots cs ON cs.id = b.class_slot_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  WHERE b.status = 'confirmed'
    AND b.daily_summary_sent_at IS NULL
    AND b.booking_date = (now() AT TIME ZONE 'Europe/Madrid')::date
    AND ((b.booking_date + cs.start_time) AT TIME ZONE 'Europe/Madrid') > now();
$$;

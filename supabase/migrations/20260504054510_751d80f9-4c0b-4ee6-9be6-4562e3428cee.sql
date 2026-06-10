ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS monitor text;
ALTER TABLE public.recurring_bookings ADD COLUMN IF NOT EXISTS monitor text;
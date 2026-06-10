-- Add class_type to bookings to support group_2, group_4 and private classes
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS class_type text NOT NULL DEFAULT 'group_4';

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_class_type_check CHECK (class_type IN ('group_2', 'group_4', 'private'));
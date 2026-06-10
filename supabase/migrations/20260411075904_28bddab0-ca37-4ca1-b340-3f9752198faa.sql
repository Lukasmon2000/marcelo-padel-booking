
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create waitlist table
CREATE TABLE public.waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_slot_id UUID NOT NULL REFERENCES public.class_slots(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, class_slot_id, booking_date)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist entries"
  ON public.waitlist FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all waitlist entries"
  ON public.waitlist FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can join waitlist"
  ON public.waitlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave waitlist"
  ON public.waitlist FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete waitlist entries"
  ON public.waitlist FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to promote first person from waitlist when a booking is cancelled
CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_waiting RECORD;
BEGIN
  -- Only trigger when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    -- Find the first person on the waitlist
    SELECT * INTO next_waiting
    FROM public.waitlist
    WHERE class_slot_id = OLD.class_slot_id
      AND booking_date = OLD.booking_date
      AND status = 'waiting'
    ORDER BY position, created_at
    LIMIT 1;

    IF next_waiting IS NOT NULL THEN
      -- Create booking for the waitlisted user
      INSERT INTO public.bookings (user_id, class_slot_id, booking_date, level, status)
      VALUES (next_waiting.user_id, next_waiting.class_slot_id, next_waiting.booking_date,
              (SELECT level FROM public.profiles WHERE user_id = next_waiting.user_id LIMIT 1),
              'confirmed');

      -- Remove from waitlist
      DELETE FROM public.waitlist WHERE id = next_waiting.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER promote_waitlist_on_cancel
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_from_waitlist();

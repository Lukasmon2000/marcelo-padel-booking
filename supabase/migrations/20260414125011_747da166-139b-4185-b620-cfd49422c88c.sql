-- Table to store user notifications (waitlist promotions, etc.)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'waitlist_promoted',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can mark their notifications as read
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- System (service role) can insert notifications
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Allow service role insert via security definer
CREATE POLICY "Allow inserts from triggers"
  ON public.notifications FOR INSERT
  TO public
  WITH CHECK (true);

-- Update the promote_from_waitlist function to also create a notification
CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_waiting RECORD;
  slot_info RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    SELECT * INTO next_waiting
    FROM public.waitlist
    WHERE class_slot_id = OLD.class_slot_id
      AND booking_date = OLD.booking_date
      AND status = 'waiting'
    ORDER BY position, created_at
    LIMIT 1;

    IF next_waiting IS NOT NULL THEN
      -- Get slot info for the notification message
      SELECT start_time, court_name, day_of_week INTO slot_info
      FROM public.class_slots
      WHERE id = OLD.class_slot_id;

      -- Create booking for the waitlisted user
      INSERT INTO public.bookings (user_id, class_slot_id, booking_date, level, status)
      VALUES (next_waiting.user_id, next_waiting.class_slot_id, next_waiting.booking_date,
              (SELECT level FROM public.profiles WHERE user_id = next_waiting.user_id LIMIT 1),
              'confirmed');

      -- Remove from waitlist
      DELETE FROM public.waitlist WHERE id = next_waiting.id;

      -- Create notification for the promoted user
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        next_waiting.user_id,
        'waitlist_promoted',
        '🎉 ¡Plaza disponible!',
        'Se ha liberado una plaza en la clase del ' || next_waiting.booking_date || 
        ' a las ' || COALESCE(slot_info.start_time::text, '') || 
        ' (' || COALESCE(slot_info.court_name, '') || '). ¡Ya tienes tu reserva confirmada!'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
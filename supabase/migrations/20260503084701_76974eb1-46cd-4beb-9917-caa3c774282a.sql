CREATE TABLE public.recurring_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_slot_id UUID NOT NULL,
  class_type TEXT NOT NULL DEFAULT 'group_4',
  level public.player_level,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_slot_id)
);

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring bookings"
  ON public.recurring_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring bookings"
  ON public.recurring_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring bookings"
  ON public.recurring_bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring bookings"
  ON public.recurring_bookings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all recurring bookings"
  ON public.recurring_bookings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_recurring_bookings_updated_at
  BEFORE UPDATE ON public.recurring_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recurring_bookings_active ON public.recurring_bookings(is_active, class_slot_id) WHERE is_active = true;
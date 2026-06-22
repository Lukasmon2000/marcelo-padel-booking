-- Fields used to avoid duplicate emails when a group booking notifies users
-- from the same level.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS group_level_notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS group_level_notification_error text;

CREATE INDEX IF NOT EXISTS idx_bookings_group_level_notifications
ON public.bookings (booking_date, class_slot_id, level)
WHERE status = 'confirmed'
  AND class_type IN ('group_2', 'group_4')
  AND group_level_notification_sent_at IS NULL;

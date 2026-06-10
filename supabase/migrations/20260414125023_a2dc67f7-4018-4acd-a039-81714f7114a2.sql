-- Fix overly permissive insert policy - only allow inserts from service role (triggers run as security definer)
DROP POLICY "Allow inserts from triggers" ON public.notifications;
DROP POLICY "Service role can insert notifications" ON public.notifications;

-- The promote_from_waitlist function runs as SECURITY DEFINER so it bypasses RLS.
-- No public insert policy is needed.
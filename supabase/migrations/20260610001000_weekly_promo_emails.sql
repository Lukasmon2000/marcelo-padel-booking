-- Weekly Monday email setup plus opt-out support.
-- Existing users are included unless they have already unsubscribed.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marketing_emails_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing_emails_enabled_at timestamptz,
ADD COLUMN IF NOT EXISTS marketing_emails_unsubscribed_at timestamptz,
ADD COLUMN IF NOT EXISTS marketing_unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

UPDATE public.profiles
SET marketing_emails_enabled = true
WHERE marketing_emails_unsubscribed_at IS NULL;

UPDATE public.profiles
SET marketing_emails_enabled_at = COALESCE(marketing_emails_enabled_at, now())
WHERE marketing_emails_enabled = true
  AND marketing_emails_unsubscribed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.weekly_promo_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_promo_email_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_marketing_emails_enabled
ON public.profiles(marketing_emails_enabled)
WHERE marketing_emails_enabled = true;

CREATE INDEX IF NOT EXISTS idx_weekly_promo_email_logs_week_start
ON public.weekly_promo_email_logs(week_start);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  wants_marketing boolean;
BEGIN
  wants_marketing := COALESCE(
    (new.raw_user_meta_data->>'marketing_emails_enabled')::boolean,
    true
  );

  INSERT INTO public.profiles (
    user_id,
    full_name,
    level,
    is_minor,
    phone,
    gender,
    marketing_emails_enabled,
    marketing_emails_enabled_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (new.raw_user_meta_data->>'level')::player_level,
      'principiante'::player_level
    ),
    COALESCE((new.raw_user_meta_data->>'is_minor')::boolean, false),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    NULLIF(new.raw_user_meta_data->>'gender', '')::public.gender,
    wants_marketing,
    CASE WHEN wants_marketing THEN now() ELSE NULL END
  );

  RETURN new;
END;
$function$;

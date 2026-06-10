alter table public.profiles
add column if not exists marketing_emails_enabled boolean not null default false,
add column if not exists marketing_emails_enabled_at timestamptz,
add column if not exists marketing_emails_unsubscribed_at timestamptz,
add column if not exists marketing_unsubscribe_token uuid not null default gen_random_uuid();

create table if not exists public.weekly_promo_email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

alter table public.weekly_promo_email_logs enable row level security;

create index if not exists idx_profiles_marketing_emails_enabled
on public.profiles(marketing_emails_enabled)
where marketing_emails_enabled = true;

create index if not exists idx_weekly_promo_email_logs_week_start
on public.weekly_promo_email_logs(week_start);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wants_marketing boolean;
begin
  wants_marketing := coalesce(
    (new.raw_user_meta_data->>'marketing_emails_enabled')::boolean,
    false
  );

  insert into public.profiles (
    user_id,
    full_name,
    level,
    is_minor,
    phone,
    gender,
    marketing_emails_enabled,
    marketing_emails_enabled_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(
      (new.raw_user_meta_data->>'level')::player_level,
      'principiante'::player_level
    ),
    coalesce((new.raw_user_meta_data->>'is_minor')::boolean, false),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'gender', '')::public.gender,
    wants_marketing,
    case when wants_marketing then now() else null end
  );

  return new;
end;
$function$;
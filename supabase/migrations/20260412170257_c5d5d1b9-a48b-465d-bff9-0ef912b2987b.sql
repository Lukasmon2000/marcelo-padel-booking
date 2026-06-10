CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, level, is_minor)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'level')::player_level,
      'principiante'::player_level
    ),
    COALESCE((NEW.raw_user_meta_data->>'is_minor')::boolean, false)
  );
  RETURN NEW;
END;
$$;
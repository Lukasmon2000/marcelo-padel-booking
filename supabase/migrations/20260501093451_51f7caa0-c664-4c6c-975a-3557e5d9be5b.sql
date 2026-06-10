-- Crear enum para género
CREATE TYPE public.gender AS ENUM ('hombre', 'mujer');

-- Añadir columna gender a profiles
ALTER TABLE public.profiles ADD COLUMN gender public.gender;

-- Actualizar handle_new_user para capturar gender y phone desde metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, level, is_minor, phone, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'level')::player_level,
      'principiante'::player_level
    ),
    COALESCE((NEW.raw_user_meta_data->>'is_minor')::boolean, false),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'gender', '')::public.gender
  );
  RETURN NEW;
END;
$function$;
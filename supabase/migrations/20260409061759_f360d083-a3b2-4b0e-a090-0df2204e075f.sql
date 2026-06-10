
-- Clean existing data
DELETE FROM bookings;
DELETE FROM class_slots;

-- Update any profiles with profesional level
UPDATE profiles SET level = 'avanzado' WHERE level = 'profesional';

-- Recreate enum without profesional
ALTER TYPE player_level RENAME TO player_level_old;
CREATE TYPE player_level AS ENUM ('principiante', 'intermedio', 'avanzado');

ALTER TABLE profiles ALTER COLUMN level DROP DEFAULT;
ALTER TABLE profiles ALTER COLUMN level TYPE player_level USING level::text::player_level;
ALTER TABLE profiles ALTER COLUMN level SET DEFAULT 'principiante';

ALTER TABLE class_slots ALTER COLUMN level DROP NOT NULL;
ALTER TABLE class_slots ALTER COLUMN level TYPE player_level USING NULL::player_level;
ALTER TABLE class_slots ALTER COLUMN level SET DEFAULT NULL;

-- Add level column to bookings to track which level booked
ALTER TABLE bookings ADD COLUMN level player_level;

DROP TYPE player_level_old;

-- Insert new schedule: Mon-Sat (0-5), 9 morning + afternoon slots
INSERT INTO class_slots (day_of_week, start_time, end_time, court_name, max_players, level)
SELECT d.day, t.st, t.et, 'Pista 1', 4, NULL
FROM (SELECT generate_series(0,5) AS day) d
CROSS JOIN (VALUES 
  ('09:00'::time, '10:00'::time),
  ('10:00'::time, '11:00'::time),
  ('11:00'::time, '12:00'::time),
  ('12:00'::time, '13:00'::time),
  ('16:30'::time, '17:30'::time),
  ('17:30'::time, '18:30'::time),
  ('18:30'::time, '19:30'::time),
  ('19:30'::time, '20:30'::time),
  ('20:30'::time, '21:30'::time)
) AS t(st, et);

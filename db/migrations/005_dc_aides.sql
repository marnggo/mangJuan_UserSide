-- Migration 005: the stand-in Manongs get DC character names and no photos (the apps show initials).
-- Requested by marn on 2026-11-14 so no real-sounding names appear in the live app.
-- Safe to run twice: each row is matched by its old key, so a second run changes nothing.
UPDATE aides AS a SET key = v.new_key, full_name = v.full_name, photo = ''
FROM (VALUES
  ('clariso', 'hal',     'Hal Jordan'),
  ('sofio',   'arthur',  'Arthur Curry'),
  ('ramon',   'barry',   'Barry Allen'),
  ('dante',   'victor',  'Victor Stone'),
  ('gordon',  'gordon',  'James Gordon'),
  ('liza',    'barbara', 'Barbara Gordon'),
  ('mario',   'oliver',  'Oliver Queen'),
  ('edgar',   'selina',  'Selina Kyle'),
  ('jones',   'jonn',    'John Jones'),
  ('paolo',   'ted',     'Ted Kord'),
  ('rey',     'wally',   'Wally West'),
  ('benny',   'roy',     'Roy Harper')
) AS v (old_key, new_key, full_name)
WHERE a.key = v.old_key;

-- James Gordon and John Jones were already DC names; their photos are cleared like the rest.
UPDATE aides SET photo = '' WHERE photo <> '';

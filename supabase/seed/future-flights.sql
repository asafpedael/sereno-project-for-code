-- Extra demo flights in the coming days (Milestone 13 check, 27.11.2026).
-- The flights of seed.sql are dated from the day the seed ran, so after a few days the public
-- form has no future flight to choose. This file only ADDS flights: nothing is deleted or changed,
-- so existing orders and customers stay as they are. Safe to re-run (same ids are skipped).
-- Run in the Supabase SQL Editor. Dates are relative to the day it runs (Israel time).

create or replace function pg_temp.il(day_offset int, t time) returns timestamptz
language sql stable as $$
  select ((((now() at time zone 'Asia/Jerusalem')::date + day_offset) + t) at time zone 'Asia/Jerusalem')
$$;

insert into public.flights (id, flight_no, airline, destination, departure_at) values
  ('f1000000-0000-4000-8000-000000000001', 'DM101', 'Demo Airlines', 'London',    pg_temp.il(1,  '14:30')),
  ('f1000000-0000-4000-8000-000000000002', 'DM102', 'Air Demo',      'Lisbon',    pg_temp.il(2,  '16:10')),
  ('f1000000-0000-4000-8000-000000000003', 'DM107', 'Demo Airlines', 'Athens',    pg_temp.il(3,  '19:45')),
  ('f1000000-0000-4000-8000-000000000004', 'DM202', 'Air Demo',      'Paris',     pg_temp.il(4,  '18:45')),
  ('f1000000-0000-4000-8000-000000000005', 'DM404', 'Demo Airlines', 'Rome',      pg_temp.il(5,  '21:20')),
  ('f1000000-0000-4000-8000-000000000006', 'DM505', 'Air Demo',      'Amsterdam', pg_temp.il(7,  '11:00')),
  ('f1000000-0000-4000-8000-000000000007', 'DM606', 'Air Demo',      'Barcelona', pg_temp.il(9,  '01:10')),
  ('f1000000-0000-4000-8000-000000000008', 'DM101', 'Demo Airlines', 'London',    pg_temp.il(14, '14:30')),
  ('f1000000-0000-4000-8000-000000000009', 'DM202', 'Air Demo',      'Paris',     pg_temp.il(21, '18:45')),
  ('f1000000-0000-4000-8000-000000000010', 'DM404', 'Demo Airlines', 'Rome',      pg_temp.il(30, '21:20'))
on conflict (id) do nothing;

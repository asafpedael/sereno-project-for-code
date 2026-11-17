-- Sereno demo data, based on spec/sereno-demo-data.xlsx (8 customers, 10 flights, 15 orders).
-- Run in the Supabase SQL Editor after 001_schema.sql.
-- All dates are relative to the day the seed runs: the Excel's 10 Dec 2026 = today (Asia/Jerusalem).
-- Run it in the morning (before 14:30 Israel time) so today's flights are still in the future.
-- Re-running it clears the three tables and loads everything again with fresh dates.
-- recommended_time values were computed with public/js/meeting-time.js and match the Excel.

begin;

-- Session-only helper: today (Israel) + day_offset, at time t, in Israel time.
create function pg_temp.il(day_offset int, t time) returns timestamptz
language sql stable as $$
  select ((((now() at time zone 'Asia/Jerusalem')::date + day_offset) + t) at time zone 'Asia/Jerusalem')
$$;

delete from public.orders;
delete from public.customers;
delete from public.flights;

insert into public.customers (id, full_name, phone, email, history_notes, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'Daniel A.', '050-1110001', 'daniel.a@example.com', 'Returning customer. 1 previous completed order (London).', pg_temp.il(-20, '10:00')),
  ('c0000000-0000-4000-8000-000000000002', 'Hadas M.',  '052-1110002', 'hadas.m@example.com',  null,                                                       pg_temp.il(-2,  '09:00')),
  ('c0000000-0000-4000-8000-000000000003', 'Noa B.',    '053-1110004', 'noa.b@example.com',    'Returning customer. 1 previous completed order (Paris).',  pg_temp.il(-22, '12:00')),
  ('c0000000-0000-4000-8000-000000000004', 'Ronen D.',  '050-1110009', 'ronen.d@example.com',  null,                                                       pg_temp.il(-3,  '11:00')),
  ('c0000000-0000-4000-8000-000000000005', 'Yossi C.',  '054-1110005', 'yossi.c@example.com',  'Returning customer. 1 previous completed order (London).', pg_temp.il(-20, '13:00')),
  ('c0000000-0000-4000-8000-000000000006', 'Maya Z.',   '050-1110006', 'maya.z@example.com',   null,                                                       pg_temp.il(-2,  '15:00')),
  ('c0000000-0000-4000-8000-000000000007', 'Alon P.',   '052-1110007', 'alon.p@example.com',   null,                                                       pg_temp.il(-1,  '08:00')),
  ('c0000000-0000-4000-8000-000000000008', 'Tamar L.',  '053-1110008', 'tamar.l@example.com',  null,                                                       pg_temp.il(-1,  '10:00'));

insert into public.flights (id, flight_no, airline, destination, departure_at) values
  ('f0000000-0000-4000-8000-000000000001', 'DM101', 'Demo Airlines', 'London',    pg_temp.il(0,  '14:30')),
  ('f0000000-0000-4000-8000-000000000002', 'DM102', 'Air Demo',      'Lisbon',    pg_temp.il(0,  '16:10')),
  ('f0000000-0000-4000-8000-000000000003', 'DM107', 'Demo Airlines', 'Athens',    pg_temp.il(0,  '19:45')),
  ('f0000000-0000-4000-8000-000000000004', 'DM202', 'Air Demo',      'Paris',     pg_temp.il(0,  '18:45')),
  ('f0000000-0000-4000-8000-000000000005', 'DM404', 'Demo Airlines', 'Rome',      pg_temp.il(1,  '21:20')),
  ('f0000000-0000-4000-8000-000000000006', 'DM505', 'Air Demo',      'Amsterdam', pg_temp.il(1,  '11:00')),
  ('f0000000-0000-4000-8000-000000000007', 'DM404', 'Demo Airlines', 'Rome',      pg_temp.il(2,  '21:20')),
  ('f0000000-0000-4000-8000-000000000008', 'DM606', 'Air Demo',      'Barcelona', pg_temp.il(2,  '01:10')),
  ('f0000000-0000-4000-8000-000000000009', 'DM101', 'Demo Airlines', 'London',    pg_temp.il(-9, '14:30')),
  ('f0000000-0000-4000-8000-000000000010', 'DM202', 'Air Demo',      'Paris',     pg_temp.il(-7, '18:45'));

-- contact_name / contact_phone are copied from each order's customer.
-- final_time = recommended_time and approved_departure_at = flight departure for approved/completed orders,
-- except order 4 (Noa B.): approved when the flight was at 20:50; the flight is now 21:20.
insert into public.orders (
  id, customer_id, flight_id, flight_no_submitted, contact_name, contact_phone,
  travelers, bags, services, escort_scope, customer_notes, status,
  recommended_time, final_time, manager_notes, approved_departure_at, decided_at, created_at
) values
  -- 1: pending, manager mockup order A1B2C3D4, returning customer
  ('a1b2c3d4-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'DM101', 'Daniel A.', '050-1110001',
   2, 3, '["porter"]', 'full', 'Travelling with one oversized bag.', 'pending',
   pg_temp.il(0, '12:45'), null, null, null, null, pg_temp.il(-1, '18:00')),
  -- 2: approved, agent mockup
  ('00000002-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'DM101', 'Ronen D.', '050-1110009',
   2, 3, '["porter"]', 'full', null, 'approved',
   pg_temp.il(0, '12:45'), pg_temp.il(0, '12:45'), 'Extra margin needed', pg_temp.il(0, '14:30'), pg_temp.il(-2, '09:30'), pg_temp.il(-3, '11:05')),
  -- 3: approved, large family
  ('00000003-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000004', 'DM202', 'Hadas M.', '052-1110002',
   5, 8, '["porter"]', 'full', null, 'approved',
   pg_temp.il(0, '16:30'), pg_temp.il(0, '16:30'), 'Large family', pg_temp.il(0, '18:45'), pg_temp.il(-2, '10:00'), pg_temp.il(-2, '09:05')),
  -- 4: approved, flight time changed (approved at 20:50, flight now 21:20)
  ('00000004-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000005', 'DM404', 'Noa B.', '053-1110004',
   2, 3, '[]', 'full', null, 'approved',
   pg_temp.il(1, '19:35'), pg_temp.il(1, '19:05'), null, pg_temp.il(1, '20:50'), pg_temp.il(-1, '09:00'), pg_temp.il(-2, '12:00')),
  -- 5: completed, history for Noa
  ('00000005-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000010', 'DM202', 'Noa B.', '053-1110004',
   2, 1, '["porter"]', 'partial', null, 'completed',
   pg_temp.il(-7, '17:05'), pg_temp.il(-7, '17:05'), null, pg_temp.il(-7, '18:45'), pg_temp.il(-15, '10:00'), pg_temp.il(-16, '12:00')),
  -- 6: needs clarification, flight DM999 not found
  ('00000006-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000005', null, 'DM999', 'Yossi C.', '054-1110005',
   1, 0, '[]', 'full', null, 'needs_clarification',
   null, null, null, null, null, pg_temp.il(-1, '11:00')),
  -- 7: rejected
  ('00000007-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000007', 'DM404', 'Yossi C.', '054-1110005',
   1, 1, '[]', 'full', null, 'rejected',
   pg_temp.il(2, '19:45'), null, null, null, pg_temp.il(-2, '14:00'), pg_temp.il(-2, '13:00')),
  -- 8: pending, wheelchair
  ('00000008-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000004', 'DM202', 'Maya Z.', '050-1110006',
   5, 4, '["wheelchair"]', 'full', null, 'pending',
   pg_temp.il(0, '16:40'), null, null, null, null, pg_temp.il(-2, '15:05')),
  -- 9: simple pending
  ('00000009-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000006', 'DM505', 'Alon P.', '052-1110007',
   3, 2, '[]', 'full', null, 'pending',
   pg_temp.il(1, '09:10'), null, null, null, null, pg_temp.il(-1, '08:05')),
  -- 10: completed, history for Daniel
  ('00000010-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000009', 'DM101', 'Daniel A.', '050-1110001',
   2, 2, '["porter"]', 'full', null, 'completed',
   pg_temp.il(-9, '12:45'), pg_temp.il(-9, '12:45'), null, pg_temp.il(-9, '14:30'), pg_temp.il(-19, '09:00'), pg_temp.il(-20, '10:05')),
  -- 11: pending, meeting crosses midnight (departure 01:10, meeting 23:40 the day before)
  ('00000011-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000008', 'DM606', 'Tamar L.', '053-1110008',
   1, 0, '[]', 'partial', null, 'pending',
   pg_temp.il(1, '23:40'), null, null, null, null, pg_temp.il(-1, '10:05')),
  -- 12: approved, upper edge (10 travelers, 10 bags = 165 min)
  ('00000012-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000002', 'DM102', 'Maya Z.', '050-1110006',
   10, 10, '["porter", "wheelchair"]', 'full', 'Group of ten.', 'approved',
   pg_temp.il(0, '13:25'), pg_temp.il(0, '13:25'), null, pg_temp.il(0, '16:10'), pg_temp.il(-1, '12:00'), pg_temp.il(-1, '11:00')),
  -- 13: approved, lower edge (1 traveler, 0 bags = 90 min), partial escort
  ('00000013-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'DM107', 'Ronen D.', '050-1110009',
   1, 0, '[]', 'partial', null, 'approved',
   pg_temp.il(0, '18:15'), pg_temp.il(0, '18:15'), null, pg_temp.il(0, '19:45'), pg_temp.il(-1, '13:00'), pg_temp.il(-1, '12:30')),
  -- 14: pending, duplicate submission of order 1
  ('00000014-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'DM101', 'Daniel A.', '050-1110001',
   2, 3, '["porter"]', 'full', 'Travelling with one oversized bag.', 'pending',
   pg_temp.il(0, '12:45'), null, null, null, null, pg_temp.il(-1, '18:02')),
  -- 15: completed, history for Yossi
  ('00000015-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000009', 'DM101', 'Yossi C.', '054-1110005',
   1, 2, '[]', 'full', null, 'completed',
   pg_temp.il(-9, '12:50'), pg_temp.il(-9, '12:50'), null, pg_temp.il(-9, '14:30'), pg_temp.il(-19, '11:00'), pg_temp.il(-20, '13:05'));

commit;

-- Expected after running: customers 8, flights 10, orders 15.
select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.flights)   as flights,
  (select count(*) from public.orders)    as orders;

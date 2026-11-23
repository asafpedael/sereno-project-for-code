-- Sereno: extra past orders for checking the archive pages (Milestone 7, plan D15).
-- Run in the Supabase SQL Editor (Development project) AFTER seed.sql.
-- Adds 12 demo customers ("Guest 01".."Guest 12", @example.com), 20 past flights
-- (2 to 59 days ago, airline "Archive Demo") and 60 past orders: 45 completed, 15 rejected.
-- No pending or approved orders, so the manager and agent screens do not change.
-- Running it again replaces its own rows; re-running seed.sql removes them.

begin;

-- Session-only helper (same as seed.sql): today (Israel) + day_offset, at time t, in Israel time.
create function pg_temp.il(day_offset int, t time) returns timestamptz
language sql stable as $$
  select ((((now() at time zone 'Asia/Jerusalem')::date + day_offset) + t) at time zone 'Asia/Jerusalem')
$$;

-- Remove this file's earlier rows (if any).
delete from public.orders
  where customer_id in (select id from public.customers where email like 'guest__@example.com');
delete from public.customers where email like 'guest__@example.com';
delete from public.flights where airline = 'Archive Demo';

insert into public.customers (full_name, phone, email, created_at)
select
  'Guest ' || lpad(i::text, 2, '0'),
  '050-22200' || lpad(i::text, 2, '0'),
  'guest' || lpad(i::text, 2, '0') || '@example.com',
  pg_temp.il(-90, '09:00')
from generate_series(1, 12) as i;

insert into public.flights (flight_no, airline, destination, departure_at)
select
  'DM7' || lpad(i::text, 2, '0'),
  'Archive Demo',
  (array['London', 'Paris', 'Rome', 'Athens', 'Lisbon', 'Amsterdam', 'Barcelona', 'Berlin'])[1 + (i - 1) % 8],
  pg_temp.il(-(i * 3 - 1), (array['06:15', '10:40', '14:30', '18:45', '21:20'])[1 + (i - 1) % 5]::time)
from generate_series(1, 20) as i;

-- 60 orders: customer and flight cycle through the demo rows; every 4th order is rejected.
-- recommended_time follows public/js/meeting-time.js (90 + 5 per extra traveller + 3 per bag,
-- rounded down to 5 minutes; the departures are on whole 5 minutes).
with c as (
  select id, full_name, phone, row_number() over (order by email) as n
  from public.customers where email like 'guest__@example.com'
), f as (
  select id, flight_no, departure_at, row_number() over (order by flight_no) as n
  from public.flights where airline = 'Archive Demo'
), o as (
  select
    i,
    1 + (i % 4) as travelers,
    i % 5 as bags,
    case when i % 4 = 0 then 'rejected' else 'completed' end as status
  from generate_series(1, 60) as i
), rows as (
  select
    o.*, c.id as customer_id, c.full_name, c.phone, f.id as flight_id, f.flight_no, f.departure_at,
    f.departure_at - make_interval(mins => (ceil((90 + 5 * (o.travelers - 1) + 3 * o.bags) / 5.0) * 5)::int) as recommended
  from o
  join c on c.n = 1 + (o.i - 1) % 12
  join f on f.n = 1 + (o.i - 1) % 20
)
insert into public.orders (
  customer_id, flight_id, flight_no_submitted, contact_name, contact_phone,
  travelers, bags, services, escort_scope, status,
  recommended_time, final_time, approved_departure_at, decided_at, created_at
)
select
  customer_id, flight_id, flight_no, full_name, phone,
  travelers, bags,
  (array['[]', '["porter"]', '["wheelchair"]', '["porter", "wheelchair"]'])[1 + i % 4]::jsonb,
  case when i % 3 = 0 then 'partial' else 'full' end,
  status,
  recommended,
  case when status = 'completed' then recommended end,
  case when status = 'completed' then departure_at end,
  departure_at - interval '3 days' + interval '2 hours',
  departure_at - interval '3 days' + make_interval(mins => i)
from rows;

commit;

-- Expected after running: 12 demo customers, 20 demo flights, 60 demo orders (45 completed, 15 rejected).
select
  (select count(*) from public.customers where email like 'guest__@example.com') as demo_customers,
  (select count(*) from public.flights where airline = 'Archive Demo') as demo_flights,
  (select count(*) from public.orders o join public.customers c on c.id = o.customer_id
     where c.email like 'guest__@example.com' and o.status = 'completed') as demo_completed,
  (select count(*) from public.orders o join public.customers c on c.id = o.customer_id
     where c.email like 'guest__@example.com' and o.status = 'rejected') as demo_rejected;

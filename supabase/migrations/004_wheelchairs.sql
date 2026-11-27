-- Milestone 11: how many wheelchairs the customer asked for (FR-08, plan D9, D10).
-- Run in the Supabase SQL Editor after 001-003. Safe to re-run.
-- 005_estimated_price.sql (Milestone 13) replaces insert_order_with_limits with a 17-parameter version.
-- Safe while the previous version of the site is live: the new column may be empty, and
-- p_wheelchairs has a default, so a call without it still saves an order (the column stays empty).
-- Nothing is deleted or changed in existing orders.

-- 1. The quantity: 1-10 and never more than the number of travellers. Empty when no wheelchair
--    was chosen, and in every order saved before Milestone 11 (shown as "Wheelchair").
alter table public.orders add column if not exists wheelchairs integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_wheelchairs_check') then
    alter table public.orders add constraint orders_wheelchairs_check
      check (wheelchairs is null or (wheelchairs between 1 and 10 and wheelchairs <= travelers));
  end if;
end;
$$;

-- 2. The insert function of 002 gets one more parameter at the end. The 15-parameter version is
--    dropped so only one version exists (two versions would make the call ambiguous).
drop function if exists public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text
);

-- Inserts a public order only if the hourly limits are not reached (FR-40, decision 12).
-- Same body as 002 (lock, limits, allowed statuses), plus the wheelchair quantity.
-- Returns the new row, or zero rows when a limit is reached or the status is not allowed.
create or replace function public.insert_order_with_limits(
  p_customer_id uuid,
  p_flight_id uuid,
  p_flight_no text,
  p_contact_name text,
  p_contact_phone text,
  p_travelers integer,
  p_bags integer,
  p_services jsonb,
  p_escort_scope text,
  p_customer_notes text,
  p_recommended timestamptz,
  p_max_per_customer integer,
  p_max_total integer,
  p_flight_date date default null,
  p_status text default 'pending',
  p_wheelchairs integer default null
) returns setof public.orders
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('pending', 'needs_clarification') then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(727001);

  if (select count(*) from public.orders
       where created_at > pg_catalog.clock_timestamp() - interval '1 hour') >= p_max_total
     or (select count(*) from public.orders
          where customer_id = p_customer_id
            and created_at > pg_catalog.clock_timestamp() - interval '1 hour') >= p_max_per_customer
  then
    return;
  end if;

  return query
    insert into public.orders (
      customer_id, flight_id, flight_no_submitted, flight_date_submitted,
      contact_name, contact_phone, travelers, bags, services, wheelchairs, escort_scope,
      customer_notes, status, recommended_time, created_at
    ) values (
      p_customer_id, p_flight_id, p_flight_no, p_flight_date,
      p_contact_name, p_contact_phone, p_travelers, p_bags, p_services, p_wheelchairs, p_escort_scope,
      p_customer_notes, p_status, p_recommended, pg_catalog.clock_timestamp()
    )
    returning *;
end;
$$;

revoke execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer
) from public, anon, authenticated;
grant execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer
) to service_role;

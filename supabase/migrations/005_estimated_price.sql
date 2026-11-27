-- Milestone 13: the estimated price of an order (FR-45, plan D4, D5).
-- Run in the Supabase SQL Editor after 001-004. Safe to re-run.
-- Safe while the previous version of the site is live: the new column may be empty, and
-- p_estimated_price has a default, so a call without it still saves an order (the column stays empty).
-- Nothing is deleted or changed in existing orders.

-- 1. The estimate in whole US dollars, worked out by the server (public/js/price.js) when the
--    order is sent. Empty in every order saved before Milestone 13 (no price is shown for them).
alter table public.orders add column if not exists estimated_price integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_estimated_price_check') then
    alter table public.orders add constraint orders_estimated_price_check
      check (estimated_price is null or estimated_price >= 0);
  end if;
end;
$$;

-- 2. The insert function of 004 gets one more parameter at the end. The 16-parameter version is
--    dropped so only one version exists (two versions would make the call ambiguous).
drop function if exists public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer
);

-- Inserts a public order only if the hourly limits are not reached (FR-40, decision 12).
-- Same body as 004 (lock, limits, allowed statuses, wheelchairs), plus the estimated price.
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
  p_wheelchairs integer default null,
  p_estimated_price integer default null
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
      customer_notes, status, recommended_time, estimated_price, created_at
    ) values (
      p_customer_id, p_flight_id, p_flight_no, p_flight_date,
      p_contact_name, p_contact_phone, p_travelers, p_bags, p_services, p_wheelchairs, p_escort_scope,
      p_customer_notes, p_status, p_recommended, p_estimated_price, pg_catalog.clock_timestamp()
    )
    returning *;
end;
$$;

revoke execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer, integer
) to service_role;

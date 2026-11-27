-- Milestone 16: more details in the booking form (FR-49, plan D7, D8): the other travellers'
-- names, the preferred language for the escort and how the customer gets to the airport.
-- Run in the Supabase SQL Editor after 001-006. Safe to re-run.
-- Safe while the previous version of the site is live: the new columns may be empty, and the
-- new parameters have defaults, so a call without them still saves an order (the columns stay empty).
-- Nothing is deleted or changed in existing orders.

-- 1. Three optional columns. The codes come from data/lists.json and are checked by the server;
--    the database checks the length only, so a new language needs no database change.
alter table public.orders add column if not exists traveller_names text;
alter table public.orders add column if not exists escort_language text;
alter table public.orders add column if not exists arrival_method text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_traveller_names_check') then
    alter table public.orders add constraint orders_traveller_names_check
      check (traveller_names is null or char_length(traveller_names) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_escort_language_check') then
    alter table public.orders add constraint orders_escort_language_check
      check (escort_language is null or char_length(escort_language) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_arrival_method_check') then
    alter table public.orders add constraint orders_arrival_method_check
      check (arrival_method is null or char_length(arrival_method) <= 20);
  end if;
end;
$$;

-- 2. The insert function of 005 gets three more parameters at the end. The 17-parameter version
--    is dropped so only one version exists (two versions would make the call ambiguous).
drop function if exists public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer, integer
);

-- Inserts a public order only if the hourly limits are not reached (FR-40, decision 12).
-- Same body as 005 (lock, limits, allowed statuses, wheelchairs, price), plus the three details.
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
  p_estimated_price integer default null,
  p_traveller_names text default null,
  p_escort_language text default null,
  p_arrival_method text default null
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
      customer_notes, status, recommended_time, estimated_price,
      traveller_names, escort_language, arrival_method, created_at
    ) values (
      p_customer_id, p_flight_id, p_flight_no, p_flight_date,
      p_contact_name, p_contact_phone, p_travelers, p_bags, p_services, p_wheelchairs, p_escort_scope,
      p_customer_notes, p_status, p_recommended, p_estimated_price,
      p_traveller_names, p_escort_language, p_arrival_method, pg_catalog.clock_timestamp()
    )
    returning *;
end;
$$;

revoke execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text, integer, integer, text, text, text
) to service_role;

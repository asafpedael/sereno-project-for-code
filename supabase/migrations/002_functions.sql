-- Sereno database functions for actions that can happen at the same moment (ARCHITECTURE section 2).
-- Run in the Supabase SQL Editor after 001_schema.sql. Safe to re-run (create or replace).
-- Each function: security invoker, empty search_path, fully qualified names,
-- execute revoked from public/anon/authenticated and granted to service_role only.

-- Inserts a public order only if the hourly limits are not reached (FR-40, decision 12).
-- A transaction-level lock makes parallel submissions wait for each other, so the count
-- and the insert act as one step and the limits cannot be bypassed by sending at once.
-- Returns the new row, or zero rows when a limit is reached.
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
  p_max_total integer
) returns setof public.orders
language plpgsql security invoker set search_path = ''
as $$
begin
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
      contact_name, contact_phone, travelers, bags, services, escort_scope,
      customer_notes, status, recommended_time, created_at
    ) values (
      p_customer_id, p_flight_id, p_flight_no, null,
      p_contact_name, p_contact_phone, p_travelers, p_bags, p_services, p_escort_scope,
      p_customer_notes, 'pending', p_recommended, pg_catalog.clock_timestamp()
    )
    returning *;
end;
$$;

revoke execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer
) from public, anon, authenticated;
grant execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer
) to service_role;

-- Records the manager's decision on an order in one conditional update (approve or reject).
-- Approving also requires a flight (orders without one cannot be approved).
-- Returns the updated row, or zero rows when the order is no longer in an allowed status
-- (already decided, or decided by someone else at the same moment): the API answers 409.
create or replace function public.decide_order(
  p_order_id uuid,
  p_from text[],
  p_to text,
  p_final_time timestamptz,
  p_notes text,
  p_departure timestamptz,
  p_recommended timestamptz
) returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set status = p_to,
         final_time = p_final_time,
         recommended_time = coalesce(p_recommended, recommended_time),
         manager_notes = coalesce(p_notes, manager_notes),
         approved_departure_at = p_departure,
         decided_at = pg_catalog.now()
   where id = p_order_id
     and status = any (p_from)
     and (p_to <> 'approved' or flight_id is not null)
  returning *;
$$;

revoke execute on function public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz
) to service_role;

-- Marks an approved order as completed (field agent, FR-41, decision 8).
-- Returns the updated row, or zero rows when the order is not approved
-- (never approved, or already completed): the API answers 409.
create or replace function public.complete_order(p_order_id uuid)
returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set status = 'completed'
   where id = p_order_id
     and status = 'approved'
  returning *;
$$;

revoke execute on function public.complete_order(uuid) from public, anon, authenticated;
grant execute on function public.complete_order(uuid) to service_role;

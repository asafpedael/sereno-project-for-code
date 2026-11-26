-- Sereno database functions for actions that can happen at the same moment (ARCHITECTURE section 2).
-- Run in the Supabase SQL Editor after 001_schema.sql. Safe to re-run (create or replace).
-- Each function: security invoker, empty search_path, fully qualified names,
-- execute revoked from public/anon/authenticated and granted to service_role only.

-- The first version (Milestones 1-4) had 13 parameters and always saved "pending".
-- It is dropped so only the version below exists (Milestone 5, plan D3).
drop function if exists public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer
);

-- Milestone 11: 004_wheelchairs.sql replaces this insert function (one more parameter).
-- After 004 has run, do not re-run this file on the same database; run 004 again instead.
-- Inserts a public order only if the hourly limits are not reached (FR-40, decision 12).
-- A transaction-level lock makes parallel submissions wait for each other, so the count
-- and the insert act as one step and the limits cannot be bypassed by sending at once.
-- p_status is "pending" (flight known) or "needs_clarification" (typed flight not found,
-- no flight id and no meeting time); p_flight_date is the date the customer typed, if any.
-- Both have defaults, so a call without them still saves a normal "pending" order.
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
  p_status text default 'pending'
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
      contact_name, contact_phone, travelers, bags, services, escort_scope,
      customer_notes, status, recommended_time, created_at
    ) values (
      p_customer_id, p_flight_id, p_flight_no, p_flight_date,
      p_contact_name, p_contact_phone, p_travelers, p_bags, p_services, p_escort_scope,
      p_customer_notes, p_status, p_recommended, pg_catalog.clock_timestamp()
    )
    returning *;
end;
$$;

revoke execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text
) from public, anon, authenticated;
grant execute on function public.insert_order_with_limits(
  uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,
  date, text
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

-- Approves or ignores a flight time change on an approved order (FR-36 to FR-39).
-- p_expected_departure is the approved departure the API read; p_new_departure is the
-- flight's current departure. Approve saves the new departure and meeting time; ignore only
-- remembers the new departure, so the "Flight time changed" mark does not return for it.
-- Returns the updated row, or zero rows when the order changed in the meantime: no longer
-- approved, already resolved, or this new departure was already ignored (plan D8, so a
-- second ignore, or approve after ignore of the same time, answers 409 and sends no email).
create or replace function public.resolve_flight_change(
  p_order_id uuid,
  p_expected_departure timestamptz,
  p_new_departure timestamptz,
  p_recommended timestamptz,
  p_final_time timestamptz,
  p_ignore boolean
) returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set approved_departure_at = case when p_ignore then approved_departure_at else p_new_departure end,
         ignored_departure_at  = case when p_ignore then p_new_departure else ignored_departure_at end,
         recommended_time      = case when p_ignore then recommended_time else p_recommended end,
         final_time            = case when p_ignore then final_time else p_final_time end
   where id = p_order_id
     and status = 'approved'
     and approved_departure_at = p_expected_departure
     and p_new_departure is distinct from p_expected_departure
     and ignored_departure_at is distinct from p_new_departure
  returning *;
$$;

revoke execute on function public.resolve_flight_change(
  uuid, timestamptz, timestamptz, timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.resolve_flight_change(
  uuid, timestamptz, timestamptz, timestamptz, timestamptz, boolean
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

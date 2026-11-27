-- Milestone 14: the customer's order lookup (FR-47, plan D5, D6, D8, D12).
-- Run in the Supabase SQL Editor after 001-005. Safe to re-run.
-- Safe while the previous version of the site is live: it never reads the new columns.
-- Nothing is deleted, and no existing order or customer detail changes.

-- 1. A counter of wrong lookup tries, on the order a wrong try named and on the customer whose
--    email it used: { "failures": n, "since": time, "locked_until": time }. Empty until then.
--    The course stack allows three tables, so the count lives here and not in a table of its own.
alter table public.orders    add column if not exists lookup_guard jsonb;
alter table public.customers add column if not exists lookup_guard jsonb;

-- 2. Finds the order whose id starts with the 8 characters AND whose customer has this email,
--    in one locked step, so parallel wrong tries cannot get past the count (ADR-7 pattern).
--    p_reference: 8 characters 0-9 / A-F (checked by the server). p_email: lower case.
--    Limits: 5 wrong tries within 15 minutes lock the order / the customer for 15 minutes.
--    While locked, every try with it answers "not found", also the right pair.
--    Returns one row: is_found = true with the order id, or is_found = false.
create or replace function public.lookup_order(p_reference text, p_email text)
returns table (is_found boolean, order_id uuid)
language plpgsql security invoker set search_path = ''
as $$
declare
  c_max_failures constant integer := 5;
  c_window constant interval := interval '15 minutes';
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_customer_id uuid;
  v_customer_guard jsonb;
  v_match uuid;
  v_locked boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(727002);

  if p_reference is null or p_reference !~ '^[0-9A-Fa-f]{8}$' or p_email is null or p_email = '' then
    return query select false, null::uuid;
    return;
  end if;

  select c.id, c.lookup_guard into v_customer_id, v_customer_guard
    from public.customers c
   where pg_catalog.lower(c.email) = p_email
   limit 1;

  -- Locked: the customer, or any order the number names.
  if v_customer_guard is not null
     and (v_customer_guard->>'locked_until')::timestamptz > v_now then
    v_locked := true;
  end if;
  if not v_locked and exists (
       select 1 from public.orders o
        where o.id::text like pg_catalog.lower(p_reference) || '%'
          and o.lookup_guard is not null
          and (o.lookup_guard->>'locked_until')::timestamptz > v_now) then
    v_locked := true;
  end if;
  if v_locked then
    return query select false, null::uuid;
    return;
  end if;

  if v_customer_id is not null then
    select o.id into v_match
      from public.orders o
     where o.id::text like pg_catalog.lower(p_reference) || '%'
       and o.customer_id = v_customer_id
     limit 1;
  end if;

  if v_match is not null then
    -- The right pair: clear both counters.
    update public.orders set lookup_guard = null where id = v_match and lookup_guard is not null;
    update public.customers set lookup_guard = null where id = v_customer_id and lookup_guard is not null;
    return query select true, v_match;
    return;
  end if;

  -- A wrong try: one more failure on every order the number names and on the customer of the email.
  -- Failures older than the window start again from zero; the 5th one locks and resets the count.
  update public.orders o
     set lookup_guard = case
           when coalesce((g.failures), 0) + 1 >= c_max_failures
             then pg_catalog.jsonb_build_object('failures', 0, 'since', v_now, 'locked_until', v_now + c_window)
           else pg_catalog.jsonb_build_object('failures', coalesce(g.failures, 0) + 1,
                                              'since', coalesce(g.since, v_now), 'locked_until', null)
         end
    from (select x.id,
                 case when (x.lookup_guard->>'since')::timestamptz > v_now - c_window
                      then (x.lookup_guard->>'failures')::integer end as failures,
                 case when (x.lookup_guard->>'since')::timestamptz > v_now - c_window
                      then (x.lookup_guard->>'since')::timestamptz end as since
            from public.orders x
           where x.id::text like pg_catalog.lower(p_reference) || '%') g
   where o.id = g.id;

  if v_customer_id is not null then
    update public.customers c
       set lookup_guard = case
             when coalesce((g.failures), 0) + 1 >= c_max_failures
               then pg_catalog.jsonb_build_object('failures', 0, 'since', v_now, 'locked_until', v_now + c_window)
             else pg_catalog.jsonb_build_object('failures', coalesce(g.failures, 0) + 1,
                                                'since', coalesce(g.since, v_now), 'locked_until', null)
           end
      from (select x.id,
                   case when (x.lookup_guard->>'since')::timestamptz > v_now - c_window
                        then (x.lookup_guard->>'failures')::integer end as failures,
                   case when (x.lookup_guard->>'since')::timestamptz > v_now - c_window
                        then (x.lookup_guard->>'since')::timestamptz end as since
              from public.customers x
             where x.id = v_customer_id) g
     where c.id = g.id;
  end if;

  return query select false, null::uuid;
end;
$$;

revoke execute on function public.lookup_order(text, text) from public, anon, authenticated;
grant execute on function public.lookup_order(text, text) to service_role;

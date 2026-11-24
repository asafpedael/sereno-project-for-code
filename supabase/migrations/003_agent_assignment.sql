-- Sereno Milestone 9: assigning a field agent to an order (feature 28, FR-27, FR-35).
-- Run once in the Supabase SQL Editor, after 001_schema.sql and 002_functions.sql.
-- Safe to re-run. Everything runs in one transaction, so the database is never half changed.
--
-- The new function parameters have a default of null, so code that does not send them yet
-- (the live site before the Milestone 9 push) keeps working: approving saves no agent, and
-- "Mark completed" works on unassigned orders (every order is unassigned at first).

begin;

-- The assigned field agent: a Supabase Auth user with the role "agent". Empty = assigned to
-- nobody, so every agent sees the order. Deleting the user returns the order to everyone.
alter table public.orders
  add column if not exists assigned_agent_id uuid references auth.users (id) on delete set null;
create index if not exists orders_assigned_agent_idx on public.orders (assigned_agent_id);

-- Records the manager's decision on an order in one conditional update (approve or reject).
-- Milestone 9: p_agent_id is saved with an approval (null = no agent); other decisions
-- never change the assigned agent.
drop function if exists public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz
);
drop function if exists public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz, uuid
);
create function public.decide_order(
  p_order_id uuid,
  p_from text[],
  p_to text,
  p_final_time timestamptz,
  p_notes text,
  p_departure timestamptz,
  p_recommended timestamptz,
  p_agent_id uuid default null
) returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set status = p_to,
         final_time = p_final_time,
         recommended_time = coalesce(p_recommended, recommended_time),
         manager_notes = coalesce(p_notes, manager_notes),
         approved_departure_at = p_departure,
         assigned_agent_id = case when p_to = 'approved' then p_agent_id else assigned_agent_id end,
         decided_at = pg_catalog.now()
   where id = p_order_id
     and status = any (p_from)
     and (p_to <> 'approved' or flight_id is not null)
  returning *;
$$;

revoke execute on function public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.decide_order(
  uuid, text[], text, timestamptz, text, timestamptz, timestamptz, uuid
) to service_role;

-- Marks an approved order as completed (field agent, FR-41, decision 8).
-- Milestone 9: only an unassigned order or one assigned to this agent (p_agent_id), and an
-- unassigned order is recorded as his. Returns zero rows otherwise: the API answers 409.
drop function if exists public.complete_order(uuid);
drop function if exists public.complete_order(uuid, uuid);
create function public.complete_order(p_order_id uuid, p_agent_id uuid default null)
returns setof public.orders
language sql security invoker set search_path = ''
as $$
  update public.orders
     set status = 'completed',
         assigned_agent_id = coalesce(assigned_agent_id, p_agent_id)
   where id = p_order_id
     and status = 'approved'
     and (assigned_agent_id is null or assigned_agent_id = p_agent_id)
  returning *;
$$;

revoke execute on function public.complete_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_order(uuid, uuid) to service_role;

commit;

-- Lets the API see the new column and functions at once.
notify pgrst, 'reload schema';

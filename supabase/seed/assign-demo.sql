-- Sereno: agent assignments for checking Milestone 9 (plan D18).
-- Run in the Supabase SQL Editor (Development project) AFTER 003_agent_assignment.sql,
-- seed.sql and archive-demo.sql. Needs at least two users with the role "agent".
-- "Agent A" and "Agent B" are the first two agent users, ordered by email.
-- Running it again gives the same result; re-running seed.sql removes the assignments.
--
--   Seed approved orders:  2 (Ronen D.) and 3 (Hadas M.) -> A,  12 (Maya Z.) -> B,
--                          4 (Noa B.) and 13 (Ronen D.) stay unassigned.
--   Seed completed orders: 5 (Noa B.) -> A, 10 (Daniel A.) -> B, 15 (Yossi C.) unassigned.
--   Demo completed orders (archive-demo.sql): one in three -> A, one in three -> B,
--                          one in three unassigned.

do $$
declare
  agent_a uuid;
  agent_b uuid;
begin
  select id into agent_a from auth.users
   where raw_app_meta_data ->> 'role' = 'agent' order by email limit 1;
  select id into agent_b from auth.users
   where raw_app_meta_data ->> 'role' = 'agent' order by email limit 1 offset 1;
  if agent_a is null or agent_b is null then
    raise exception 'Two users with the role "agent" are needed. Create the second agent first.';
  end if;

  -- Start from no assignments.
  update public.orders set assigned_agent_id = null where assigned_agent_id is not null;

  update public.orders set assigned_agent_id = agent_a
   where id in ('00000002-0000-4000-8000-000000000002', '00000003-0000-4000-8000-000000000003',
                '00000005-0000-4000-8000-000000000005');
  update public.orders set assigned_agent_id = agent_b
   where id in ('00000012-0000-4000-8000-000000000012', '00000010-0000-4000-8000-000000000010');

  update public.orders o
     set assigned_agent_id = case d.rn % 3 when 0 then agent_a when 1 then agent_b end
    from (
      select o2.id, row_number() over (order by o2.id) as rn
        from public.orders o2
        join public.customers c on c.id = o2.customer_id
       where c.email like 'guest__@example.com' and o2.status = 'completed'
    ) d
   where o.id = d.id;
end;
$$;

-- What to expect: each agent's email and how many approved / completed orders he has.
select u.email,
       count(*) filter (where o.status = 'approved') as approved,
       count(*) filter (where o.status = 'completed') as completed
  from public.orders o
  join auth.users u on u.id = o.assigned_agent_id
 group by u.email
 order by u.email;

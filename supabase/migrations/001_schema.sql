-- Sereno: tables, row level security and grants.
-- Run once in the Supabase SQL Editor.
-- The browser never reads these tables: RLS is on with no policies and
-- anon/authenticated have no privileges. Only server functions (service_role) can access them.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null,
  email text not null unique,
  history_notes text,
  created_at timestamptz not null default now()
);

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_no text not null,
  airline text,
  destination text not null,
  departure_at timestamptz not null,
  unique (flight_no, departure_at)
);
create index flights_flight_no_idx on public.flights (flight_no);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  flight_id uuid references public.flights (id),
  flight_no_submitted text not null,
  flight_date_submitted date,
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  contact_phone text not null,
  travelers integer not null check (travelers between 1 and 10),
  bags integer not null check (bags between 0 and 10),
  services jsonb not null default '[]'::jsonb,
  escort_scope text not null check (escort_scope in ('full', 'partial')),
  customer_notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'needs_clarification', 'completed')),
  recommended_time timestamptz,
  final_time timestamptz,
  manager_notes text,
  ai_output jsonb,
  approved_departure_at timestamptz,
  ignored_departure_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status);
create index orders_customer_idx on public.orders (customer_id);
create index orders_flight_idx on public.orders (flight_id);
create index orders_created_idx on public.orders (created_at desc);

alter table public.customers enable row level security;
alter table public.flights   enable row level security;
alter table public.orders    enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.flights   from anon, authenticated;
revoke all on public.orders    from anon, authenticated;

grant select, insert, update on public.customers to service_role;
grant select                 on public.flights   to service_role;
grant select, insert, update on public.orders    to service_role;

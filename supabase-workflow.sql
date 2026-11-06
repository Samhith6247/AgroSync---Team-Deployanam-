-- AgroSync harvest approval and delivery workflow.
-- Run in Supabase SQL Editor before using the multi-role React workflow.
-- Staff roles are read only from Supabase app_metadata. Farmer and Consumer roles can self-register.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('Farmer', 'Mandal Operator', 'Consumer', 'Delivery Agent')),
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.current_agrosync_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.create_agrosync_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
begin
  if coalesce(requested_role, '') not in ('Mandal Operator', 'Delivery Agent') then
    requested_role := new.raw_user_meta_data ->> 'role';
    if coalesce(requested_role, '') not in ('Farmer', 'Consumer') then
      requested_role := 'Consumer';
    end if;
  end if;

  insert into public.profiles (id, role, display_name)
  values (new.id, requested_role, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_agrosync on auth.users;
create trigger on_auth_user_created_agrosync
  after insert on auth.users
  for each row execute procedure public.create_agrosync_profile();

create or replace function public.sync_agrosync_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text := new.raw_app_meta_data ->> 'role';
begin
  if assigned_role in ('Mandal Operator', 'Delivery Agent') then
    update public.profiles set role = assigned_role where id = new.id;
  else
    assigned_role := new.raw_user_meta_data ->> 'role';
    if assigned_role in ('Farmer', 'Consumer') then
      update public.profiles set role = assigned_role where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_role_updated_agrosync on auth.users;
create trigger on_auth_user_role_updated_agrosync
  after update of raw_app_meta_data, raw_user_meta_data on auth.users
  for each row execute procedure public.sync_agrosync_profile_role();

insert into public.profiles (id, role, display_name)
select id,
  case
    when raw_app_meta_data ->> 'role' in ('Mandal Operator', 'Delivery Agent') then raw_app_meta_data ->> 'role'
    when raw_user_meta_data ->> 'role' in ('Farmer', 'Consumer') then raw_user_meta_data ->> 'role'
    else 'Consumer'
  end,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create table if not exists public.harvest_listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references auth.users(id) on delete cascade,
  farmer_name text not null,
  crop_name text not null,
  category text not null check (category in ('Fruits', 'Vegetables', 'Grains', 'Pulses', 'Other')),
  variety text not null default '',
  quantity_kg numeric(12,2) not null check (quantity_kg > 0),
  expected_price numeric(12,2) not null check (expected_price > 0),
  village text not null,
  harvest_date date not null,
  pickup_date date,
  quality_notes text not null default '',
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  grade text check (grade in ('A', 'B', 'C')),
  approved_price numeric(12,2) check (approved_price is null or approved_price > 0),
  approved_quantity_kg numeric(12,2) check (approved_quantity_kg is null or (approved_quantity_kg >= 0 and approved_quantity_kg <= quantity_kg)),
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists harvest_listings_status_created_idx on public.harvest_listings(status, created_at);
create index if not exists harvest_listings_farmer_created_idx on public.harvest_listings(farmer_id, created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references auth.users(id),
  consumer_name text not null,
  delivery_address text not null default '',
  fulfillment text not null check (fulfillment in ('delivery', 'collect')),
  status text not null default 'placed' check (status in ('placed', 'accepted', 'picked_up', 'delivered')),
  assigned_agent_id uuid references auth.users(id),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_delivery_queue_idx on public.orders(fulfillment, status, created_at);
create index if not exists orders_consumer_created_idx on public.orders(consumer_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  harvest_id uuid references public.harvest_listings(id),
  product_name text not null,
  farmer_name text not null,
  quantity_kg numeric(12,2) not null check (quantity_kg > 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items(order_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'harvest_listings') then
      execute 'alter publication supabase_realtime add table public.harvest_listings';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
      execute 'alter publication supabase_realtime add table public.orders';
    end if;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.harvest_listings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Users can read own AgroSync profile" on public.profiles;
create policy "Users can read own AgroSync profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Approved harvests are public; owners and operators can read all" on public.harvest_listings;
create policy "Approved harvests are public; owners and operators can read all"
  on public.harvest_listings for select to anon, authenticated
  using (status = 'approved' or farmer_id = auth.uid() or public.current_agrosync_role() = 'Mandal Operator');

drop policy if exists "Farmers can submit their own harvests" on public.harvest_listings;
create policy "Farmers can submit their own harvests"
  on public.harvest_listings for insert to authenticated
  with check (farmer_id = auth.uid() and public.current_agrosync_role() = 'Farmer' and status = 'pending');

drop policy if exists "Operators can review pending harvests" on public.harvest_listings;
create policy "Operators can review pending harvests"
  on public.harvest_listings for update to authenticated
  using (public.current_agrosync_role() = 'Mandal Operator' and status = 'pending')
  with check (public.current_agrosync_role() = 'Mandal Operator' and reviewed_by = auth.uid() and status in ('approved', 'rejected'));

drop policy if exists "Consumers and assigned agents can read orders" on public.orders;
create policy "Consumers and assigned agents can read orders"
  on public.orders for select to authenticated
  using (
    consumer_id = auth.uid()
    or (public.current_agrosync_role() = 'Delivery Agent' and fulfillment = 'delivery' and (status = 'placed' or assigned_agent_id = auth.uid()))
  );

drop policy if exists "Order items follow their order visibility" on public.order_items;
create policy "Order items follow their order visibility"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.consumer_id = auth.uid() or (public.current_agrosync_role() = 'Delivery Agent' and o.fulfillment = 'delivery' and (o.status = 'placed' or o.assigned_agent_id = auth.uid())))
  ));

create or replace function public.place_agrosync_order(
  p_customer_name text,
  p_delivery_address text,
  p_fulfillment text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid;
  item jsonb;
  item_quantity numeric(12,2);
  item_harvest_id uuid;
  expected_unit_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  calculated_delivery numeric(12,2) := 0;
begin
  if auth.uid() is null or public.current_agrosync_role() <> 'Consumer' then
    raise exception 'Only signed-in consumers can place orders';
  end if;
  if p_fulfillment not in ('delivery', 'collect') then
    raise exception 'Invalid fulfillment method';
  end if;
  if p_fulfillment = 'delivery' and coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'A delivery address is required';
  end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item to the order';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item ->> 'quantity_kg')::numeric;
    if item_quantity <= 0 or (item ->> 'unit_price')::numeric <= 0 then
      raise exception 'Order item quantity and price must be positive';
    end if;
    calculated_subtotal := calculated_subtotal + item_quantity * (item ->> 'unit_price')::numeric;
    item_harvest_id := nullif(item ->> 'harvest_id', '')::uuid;
    if item_harvest_id is not null then
      select approved_price into expected_unit_price
      from public.harvest_listings
      where id = item_harvest_id and status = 'approved'
      for update;
      if not found then raise exception 'A harvest listing is no longer available'; end if;
      if expected_unit_price <> (item ->> 'unit_price')::numeric then
        raise exception 'The marketplace price changed; refresh your basket';
      end if;
      update public.harvest_listings
      set approved_quantity_kg = approved_quantity_kg - item_quantity
      where id = item_harvest_id
        and status = 'approved'
        and approved_quantity_kg >= item_quantity;
      if not found then
        raise exception 'A harvest listing no longer has enough stock';
      end if;
    end if;
  end loop;

  if p_fulfillment = 'delivery' then calculated_delivery := 20; end if;
  insert into public.orders (consumer_id, consumer_name, delivery_address, fulfillment, status, subtotal, delivery_fee, total_amount)
  values (auth.uid(), coalesce(nullif(trim(p_customer_name), ''), 'AgroSync customer'), coalesce(p_delivery_address, ''), p_fulfillment, 'placed', calculated_subtotal, calculated_delivery, calculated_subtotal + calculated_delivery)
  returning id into new_order_id;

  insert into public.order_items (order_id, harvest_id, product_name, farmer_name, quantity_kg, unit_price)
  select new_order_id,
    nullif(value ->> 'harvest_id', '')::uuid,
    value ->> 'product_name',
    coalesce(nullif(value ->> 'farmer_name', ''), 'AgroSync partner farmer'),
    (value ->> 'quantity_kg')::numeric,
    (value ->> 'unit_price')::numeric
  from jsonb_array_elements(p_items);
  return new_order_id;
end;
$$;

create or replace function public.claim_delivery_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_agrosync_role() <> 'Delivery Agent' then
    raise exception 'Only delivery agents can claim orders';
  end if;
  update public.orders
  set assigned_agent_id = auth.uid(), status = 'accepted', updated_at = now()
  where id = p_order_id and fulfillment = 'delivery' and status = 'placed' and assigned_agent_id is null;
  if not found then raise exception 'This order is no longer available'; end if;
end;
$$;

create or replace function public.update_delivery_order(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if auth.uid() is null or public.current_agrosync_role() <> 'Delivery Agent' then
    raise exception 'Only delivery agents can update delivery status';
  end if;
  select status into current_status from public.orders
  where id = p_order_id and assigned_agent_id = auth.uid() and fulfillment = 'delivery'
  for update;
  if current_status is null then raise exception 'Order is not assigned to this agent'; end if;
  if not ((current_status = 'accepted' and p_status = 'picked_up') or (current_status = 'picked_up' and p_status = 'delivered')) then
    raise exception 'Invalid delivery status transition';
  end if;
  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$$;

revoke all on function public.current_agrosync_role() from public;
grant execute on function public.current_agrosync_role() to anon, authenticated;
revoke all on function public.create_agrosync_profile() from public;
revoke all on function public.sync_agrosync_profile_role() from public;
revoke all on function public.place_agrosync_order(text, text, text, jsonb) from public;
grant execute on function public.place_agrosync_order(text, text, text, jsonb) to authenticated;
revoke all on function public.claim_delivery_order(uuid) from public;
grant execute on function public.claim_delivery_order(uuid) to authenticated;
revoke all on function public.update_delivery_order(uuid, text) from public;
grant execute on function public.update_delivery_order(uuid, text) to authenticated;

grant select on public.harvest_listings to anon, authenticated;
grant insert, update on public.harvest_listings to authenticated;
grant select on public.profiles to authenticated;
grant select on public.orders, public.order_items to authenticated;

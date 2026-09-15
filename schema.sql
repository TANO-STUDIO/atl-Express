-- Alt Express: rate table + quotes + bookings schema

create table rate_table (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  weight_min numeric not null,   -- kg, inclusive
  weight_max numeric not null,   -- kg, inclusive
  price numeric not null,
  currency text not null default 'USD',
  created_at timestamptz default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  weight numeric not null,
  calculated_rate numeric,
  currency text default 'USD',
  email text,
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),

  -- Sender
  sender_name text not null,
  sender_phone text,
  sender_email text,
  sender_address text not null,

  -- Receiver
  receiver_name text not null,
  receiver_phone text,
  receiver_email text,
  receiver_address text not null,
  destination_country text not null,

  -- Package
  weight numeric not null,          -- kg
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  declared_value numeric,
  contents_description text,

  -- Service
  service_type text not null,       -- e.g. 'standard', 'express', 'economy'
  calculated_rate numeric,
  currency text default 'USD',

  -- Status
  status text not null default 'pending',  -- pending, confirmed, picked_up, in_transit, delivered, cancelled
  tracking_number text,

  created_at timestamptz default now()
);

-- Row Level Security
alter table rate_table enable row level security;
alter table quotes enable row level security;
alter table bookings enable row level security;

-- Anyone (anon) can read rates, to power the calculator
create policy "Public can read rates"
  on rate_table for select
  using (true);

-- Anyone (anon) can submit a quote request, but not read others'
create policy "Public can insert quotes"
  on quotes for insert
  with check (true);

-- Anyone (anon) can create a booking
create policy "Public can insert bookings"
  on bookings for insert
  with check (true);

-- Example seed rows — replace with your real pricing
insert into rate_table (origin, destination, weight_min, weight_max, price, currency) values
  ('United States', 'France', 0, 1, 18.50, 'USD'),
  ('United States', 'France', 1, 5, 34.00, 'USD'),
  ('United States', 'France', 5, 20, 79.00, 'USD'),
  ('Germany', 'United States', 0, 1, 21.00, 'USD'),
  ('Germany', 'United States', 1, 5, 39.50, 'USD'),
  ('Cameroon', 'France', 0, 1, 15.00, 'USD'),
  ('Cameroon', 'France', 1, 5, 29.00, 'USD'),
  ('United Kingdom', 'Canada', 0, 1, 20.00, 'USD'),
  ('United Kingdom', 'Canada', 1, 5, 37.00, 'USD');

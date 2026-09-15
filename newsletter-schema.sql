-- Alt Express: Newsletter subscribers table
-- Run this in SQL Editor once.

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz default now()
);

alter table newsletter_subscribers enable row level security;

-- Anyone can subscribe (insert their email), but can't read the list of subscribers
create policy "Public can subscribe to newsletter"
  on newsletter_subscribers for insert
  with check (true);

-- Only staff can view the subscriber list
create policy "Authenticated can read subscribers"
  on newsletter_subscribers for select
  to authenticated
  using (true);

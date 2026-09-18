-- Alt Express: Contact form messages table
-- Run this in the Supabase SQL Editor.

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  topic text,
  message text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' -- 'new' | 'read' | 'replied'
);

alter table contact_messages enable row level security;

-- No public read/write via the anon key directly — inserts happen only
-- through the Edge Function using the service role key, so the public
-- can never read other people's messages or spam-insert rows arbitrarily
-- without going through the function's own validation.
-- (No policies are added, which means anon/authenticated have zero access
-- by default under RLS — exactly what we want here.)

-- Optional: allow you (as an authenticated admin) to view messages
-- in a future admin-dashboard "Inbox" page. Uncomment and adjust once
-- you have an admin role/claim to check against.
-- create policy "Admins can view messages"
--   on contact_messages for select
--   using (auth.jwt() ->> 'role' = 'admin');

-- Alt Express: Admin access policies
-- Run this AFTER the original schema.sql has already been applied.

-- Allow any authenticated (logged-in) user to update bookings (status changes, tracking numbers, etc.)
create policy "Authenticated can update bookings"
  on bookings for update
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users to view all bookings (not just their own — there's no user ownership on bookings yet)
create policy "Authenticated can read all bookings"
  on bookings for select
  to authenticated
  using (true);

-- Allow authenticated users to view all quotes
create policy "Authenticated can read all quotes"
  on quotes for select
  to authenticated
  using (true);

-- Allow authenticated users to manage rate_table pricing
create policy "Authenticated can insert rates"
  on rate_table for insert
  to authenticated
  with check (true);

create policy "Authenticated can update rates"
  on rate_table for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can delete rates"
  on rate_table for delete
  to authenticated
  using (true);

-- ============================================
-- HOW TO CREATE ADMIN ACCOUNTS
-- ============================================
-- Supabase Auth users are NOT created via SQL insert into a table.
-- Instead, go to: Supabase Dashboard → Authentication → Users → "Add user"
-- Create one user per staff member with their email + a password.
-- They will then be able to log in at admin-login.html using those credentials.
--
-- To remove access later, just delete or disable that user from the same screen.

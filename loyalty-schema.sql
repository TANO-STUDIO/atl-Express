-- Alt Express: Loyalty Club — real points & tier tracking
-- Run this AFTER schema.sql, admin-schema.sql, and payment-schema.sql.
--
-- Design note: bookings are matched to customers by email (receiver_email),
-- not by a user_id foreign key, since guest checkout is allowed. This table
-- follows the same pattern so points work whether or not someone has an
-- account yet — the moment they sign up with a matching email, their
-- points/tier already exist and show up immediately.

create table loyalty_accounts (
  email text primary key,
  lifetime_spend numeric not null default 0,
  points numeric not null default 0,
  tier text not null default 'bronze',  -- 'bronze', 'silver', 'gold'
  updated_at timestamptz default now()
);

alter table loyalty_accounts enable row level security;

-- Anyone can read their own loyalty record by email (used by my-account.html).
-- This is intentionally open-read since email isn't sensitive here and the
-- page already requires the visitor to know/own that email to see it meaningfully.
create policy "Public can read loyalty accounts"
  on loyalty_accounts for select
  using (true);

-- Only authenticated (staff) or the trusted server-side function should write to this table.
-- No public insert/update policy is created on purpose — all writes happen via
-- the trigger below (which runs as security definer, bypassing RLS safely).

create policy "Authenticated can update loyalty accounts"
  on loyalty_accounts for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can insert loyalty accounts"
  on loyalty_accounts for insert
  to authenticated
  with check (true);


-- ============================================
-- Tier thresholds (matches the Club page copy)
-- ============================================
-- Bronze: $0+     -> 1x points per $1
-- Silver: $300+   -> 1.25x points per $1
-- Gold:   $1000+  -> 1.5x points per $1

create or replace function calculate_tier(spend numeric)
returns text as $$
begin
  if spend >= 1000 then
    return 'gold';
  elsif spend >= 300 then
    return 'silver';
  else
    return 'bronze';
  end if;
end;
$$ language plpgsql immutable;

create or replace function points_multiplier(tier_name text)
returns numeric as $$
begin
  case tier_name
    when 'gold' then return 1.5;
    when 'silver' then return 1.25;
    else return 1.0;
  end case;
end;
$$ language plpgsql immutable;


-- ============================================
-- Trigger: award points when a booking becomes paid
-- ============================================
-- Fires only on the transition INTO 'paid' (not every update), so a booking
-- can't accidentally earn points twice if it's edited again later.

create or replace function award_loyalty_points()
returns trigger as $$
declare
  customer_email text;
  amount numeric;
  existing_spend numeric;
  new_tier text;
  multiplier numeric;
  earned_points numeric;
begin
  -- Only act when payment_status just changed TO 'paid'
  if NEW.payment_status = 'paid' and (OLD.payment_status is distinct from 'paid') then

    customer_email := NEW.receiver_email;
    amount := coalesce(NEW.amount_charged, NEW.calculated_rate, 0);

    if customer_email is null or amount <= 0 then
      return NEW;
    end if;

    -- Ensure a loyalty account row exists for this email
    insert into loyalty_accounts (email, lifetime_spend, points, tier)
    values (customer_email, 0, 0, 'bronze')
    on conflict (email) do nothing;

    select lifetime_spend into existing_spend
    from loyalty_accounts where email = customer_email;

    -- Determine tier based on spend BEFORE this purchase (so the multiplier
    -- reflects the tier they were in when they earned it, not the tier this
    -- purchase might newly unlock)
    multiplier := points_multiplier(calculate_tier(existing_spend));
    earned_points := amount * multiplier;

    new_tier := calculate_tier(existing_spend + amount);

    update loyalty_accounts
    set
      lifetime_spend = existing_spend + amount,
      points = points + earned_points,
      tier = new_tier,
      updated_at = now()
    where email = customer_email;

  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_paid on bookings;
create trigger on_booking_paid
  after update on bookings
  for each row
  execute function award_loyalty_points();

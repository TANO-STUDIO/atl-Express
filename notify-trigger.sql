-- Alt Express: Auto-notify trigger for booking status changes
-- Run this AFTER deploying the notify-status-change Edge Function.
--
-- IMPORTANT: Before running this, set your service_role key as a database setting.
-- Go to SQL Editor and run (replace with YOUR actual service_role key from
-- Settings → API Keys → Legacy anon, service_role API keys):
--
--   alter database postgres set app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';
--
-- Then reconnect/re-run this file. This lets the trigger authenticate to your
-- Edge Function without exposing the key anywhere in your public HTML.

-- Enable the pg_net extension (lets Postgres make HTTP calls)
create extension if not exists pg_net;

-- Function that calls the Edge Function via HTTP whenever a booking's status changes
create or replace function notify_booking_status_change()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    perform net.http_post(
      url := 'https://iynlknwijrxtysinppwh.supabase.co/functions/v1/notify-status-change',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'record', to_jsonb(NEW),
        'old_record', to_jsonb(OLD)
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger that fires the function after every booking update
drop trigger if exists on_booking_status_change on bookings;
create trigger on_booking_status_change
  after update on bookings
  for each row
  execute function notify_booking_status_change();

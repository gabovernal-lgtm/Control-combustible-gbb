-- New deliveries are inserted only by the server after signed QR validation.
-- Authenticated clients retain existing read/update policies for administrators.
drop policy if exists deliveries_insert on public.fuel_deliveries;

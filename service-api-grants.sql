-- The server API authenticates the user, checks the active profile and then
-- performs its authorized operations using the service role.
-- Client roles and their RLS policies are unchanged.
grant select,insert,update on public.profiles to service_role;
grant select,insert on public.fuel_deliveries to service_role;

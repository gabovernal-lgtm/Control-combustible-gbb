drop policy if exists deliveries_read on public.fuel_deliveries;
drop policy if exists deliveries_receiver_read on public.fuel_deliveries;
create policy deliveries_read on public.fuel_deliveries for select to authenticated using (public.is_fuel_admin());
drop policy if exists receiver_qr_claims_read on public.receiver_qr_claims;
create policy receiver_qr_claims_read on public.receiver_qr_claims for select to authenticated using (public.is_fuel_admin());
drop policy if exists qr_conflicts_read on public.receiver_qr_conflicts;
create policy qr_conflicts_read on public.receiver_qr_conflicts for select to authenticated using (public.is_fuel_admin());
revoke execute on function public.confirm_fuel_receipt(uuid,boolean,text) from public,anon,authenticated;

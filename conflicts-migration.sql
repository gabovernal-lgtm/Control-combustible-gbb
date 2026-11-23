create table public.receiver_qr_conflicts (
 id uuid primary key default gen_random_uuid(), token_id uuid not null,
 attempted_delivery_id uuid not null, driver_id uuid not null references public.profiles(id),
 attempted_delivery jsonb not null, reason text not null, created_at timestamptz not null default now(),
 unique(token_id,attempted_delivery_id)
);
alter table public.receiver_qr_conflicts enable row level security;
create policy qr_conflicts_read on public.receiver_qr_conflicts for select to authenticated using (driver_id=auth.uid() or public.is_fuel_admin());
create index qr_conflicts_driver_idx on public.receiver_qr_conflicts(driver_id);
revoke all on public.receiver_qr_conflicts from anon,authenticated;
grant select on public.receiver_qr_conflicts to authenticated;
grant all on public.receiver_qr_conflicts to service_role;

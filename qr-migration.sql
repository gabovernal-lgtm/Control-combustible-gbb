create table public.receiver_devices (
 id uuid primary key, receiver_id uuid not null references public.profiles(id),
 public_jwk jsonb not null, active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.receiver_devices enable row level security;
create policy receiver_devices_read on public.receiver_devices for select to authenticated using (public.is_fuel_driver());
create index receiver_devices_receiver_idx on public.receiver_devices(receiver_id);
create table public.receiver_qr_claims (
 token_id uuid primary key, delivery_id uuid not null unique references public.fuel_deliveries(id),
 device_id uuid not null references public.receiver_devices(id), receiver_id uuid not null references public.profiles(id),
 driver_id uuid not null references public.profiles(id), issued_at timestamptz not null,
 scanned_at timestamptz not null, synced_at timestamptz not null default now(), delivery_snapshot jsonb not null
);
alter table public.receiver_qr_claims enable row level security;
create policy receiver_qr_claims_read on public.receiver_qr_claims for select to authenticated using (driver_id=auth.uid() or receiver_id=auth.uid() or public.is_fuel_admin());
create index receiver_qr_claims_device_idx on public.receiver_qr_claims(device_id);
create index receiver_qr_claims_receiver_idx on public.receiver_qr_claims(receiver_id);
create index receiver_qr_claims_driver_idx on public.receiver_qr_claims(driver_id);
alter table public.fuel_deliveries add column qr_token_id uuid unique, add column validation_method text;
drop policy deliveries_insert on public.fuel_deliveries;
create policy deliveries_insert on public.fuel_deliveries for insert to authenticated with check (
 driver_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','driver'))
 and receipt_status in ('not_requested','pending') and qr_token_id is null and validation_method is null and receipt_confirmed_at is null
);
create or replace function public.claim_receiver_qr(p_driver_id uuid,p_device_id uuid,p_receiver_id uuid,p_token_id uuid,p_issued_at timestamptz,p_scanned_at timestamptz,p_delivery jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.receiver_qr_claims%rowtype; v_id uuid := (p_delivery->>'id')::uuid;
begin
 if auth.role() <> 'service_role' then raise exception 'No autorizado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 if not exists(select 1 from public.profiles where id=p_driver_id and active and role in ('driver','admin')) then raise exception 'Conductor inactivo'; end if;
 if not exists(select 1 from public.profiles p join public.receiver_devices d on d.receiver_id=p.id where p.id=p_receiver_id and p.active and p.role='receiver' and d.id=p_device_id and d.active) then raise exception 'Receptor o dispositivo inactivo'; end if;
 select * into v_existing from public.receiver_qr_claims where token_id=p_token_id;
 if found then
  if v_existing.delivery_id=v_id and v_existing.driver_id=p_driver_id and v_existing.delivery_snapshot=p_delivery then return jsonb_build_object('accepted',true,'idempotent',true); end if;
  raise exception 'QR_ALREADY_USED' using errcode='23505';
 end if;
 if exists(select 1 from public.fuel_deliveries where id=v_id) then raise exception 'DELIVERY_ALREADY_EXISTS'; end if;
 if p_scanned_at < p_issued_at - interval '5 minutes' or p_scanned_at > p_issued_at + interval '24 hours' or p_scanned_at > now()+interval '5 minutes' then raise exception 'QR_EXPIRED'; end if;
 insert into public.fuel_deliveries(id,driver_id,truck_id,equipment_id,other_equipment,liters,shift,delivered_at,notes,receiver_id,receipt_status,receipt_confirmed_at,receipt_note,qr_token_id,validation_method)
 values(v_id,p_driver_id,(p_delivery->>'truck_id')::uuid,nullif(p_delivery->>'equipment_id','')::uuid,nullif(p_delivery->>'other_equipment',''),(p_delivery->>'liters')::numeric,p_delivery->>'shift',(p_delivery->>'delivered_at')::timestamptz,left(coalesce(p_delivery->>'notes',''),2000),p_receiver_id,'accepted',p_scanned_at,'Identidad validada mediante QR de un solo uso',p_token_id,'receiver_qr');
 insert into public.receiver_qr_claims(token_id,delivery_id,device_id,receiver_id,driver_id,issued_at,scanned_at,delivery_snapshot)
 values(p_token_id,v_id,p_device_id,p_receiver_id,p_driver_id,p_issued_at,p_scanned_at,p_delivery);
 return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.claim_receiver_qr(uuid,uuid,uuid,uuid,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.claim_receiver_qr(uuid,uuid,uuid,uuid,timestamptz,timestamptz,jsonb) to service_role;
revoke all on public.receiver_devices,public.receiver_qr_claims from anon;
grant select on public.receiver_devices,public.receiver_qr_claims to authenticated;
grant all on public.receiver_devices,public.receiver_qr_claims to service_role;

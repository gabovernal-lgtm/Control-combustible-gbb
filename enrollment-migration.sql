alter table public.profiles add column access_status text not null default 'approved' check (access_status in ('pending','approved','rejected'));
alter table public.profiles add constraint profiles_active_requires_approval check (not active or access_status='approved');
create table public.fuel_account_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 full_name text not null, email text not null unique, requested_role text not null check(requested_role in ('driver','receiver')),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id), review_note text
);
alter table public.fuel_account_requests enable row level security;
create policy account_requests_admin_read on public.fuel_account_requests for select to authenticated using(public.is_fuel_admin());
create index fuel_account_requests_status_idx on public.fuel_account_requests(status,created_at);
create index fuel_account_requests_reviewer_idx on public.fuel_account_requests(reviewed_by);
revoke all on public.fuel_account_requests from anon,authenticated;
grant select on public.fuel_account_requests to authenticated;
grant all on public.fuel_account_requests to service_role;
create table public.fuel_signup_attempts (
 id bigint generated always as identity primary key, email_key text not null, client_key text not null, created_at timestamptz not null default now()
);
alter table public.fuel_signup_attempts enable row level security;
revoke all on public.fuel_signup_attempts from anon,authenticated;
grant all on public.fuel_signup_attempts to service_role;
create index fuel_signup_attempts_time_idx on public.fuel_signup_attempts(created_at);
create index fuel_signup_attempts_email_idx on public.fuel_signup_attempts(email_key,created_at);
create index fuel_signup_attempts_client_idx on public.fuel_signup_attempts(client_key,created_at);
create function public.allow_fuel_account_request(p_email_key text,p_client_key text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado'; end if;
 if length(p_email_key)<>64 or length(p_client_key)<>64 then raise exception 'Solicitud inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fuel-signup-limit',0));
 delete from public.fuel_signup_attempts where created_at<now()-interval '2 days';
 if (select count(*) from public.fuel_signup_attempts where created_at>now()-interval '1 hour')>=200
 or (select count(*) from public.fuel_signup_attempts where email_key=p_email_key and created_at>now()-interval '1 hour')>=3
 or (select count(*) from public.fuel_signup_attempts where client_key=p_client_key and created_at>now()-interval '1 hour')>=60 then return false; end if;
 insert into public.fuel_signup_attempts(email_key,client_key) values(p_email_key,p_client_key);return true;
end $$;
create function public.submit_fuel_account_request(p_user_id uuid,p_name text,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'No autorizado'; end if;
 if p_role not in ('driver','receiver') or length(trim(p_name))<2 or length(p_name)>120 or length(p_email)>254 then raise exception 'Datos inválidos'; end if;
 insert into public.profiles(id,full_name,role,active,access_status) values(p_user_id,trim(p_name),p_role,false,'pending');
 insert into public.fuel_account_requests(user_id,full_name,email,requested_role) values(p_user_id,trim(p_name),lower(trim(p_email)),p_role) returning id into result;
 return result;
end $$;
create function public.review_fuel_account_request(p_admin_id uuid,p_request_id uuid,p_approve boolean,p_role text,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.fuel_account_requests%rowtype; target text:=case when p_approve then 'approved' else 'rejected' end;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.profiles where id=p_admin_id and active and role='admin') then raise exception 'Solo administrador'; end if;
 if p_role not in ('driver','receiver') then raise exception 'Perfil inválido'; end if;
 select * into r from public.fuel_account_requests where id=p_request_id for update;
 if not found then raise exception 'Solicitud no encontrada'; end if;
 if r.status=target then return jsonb_build_object('ok',true,'idempotent',true); end if;
 if r.status='approved' then raise exception 'La solicitud ya fue aprobada; usa Usuarios y perfiles para desactivar el acceso.'; end if;
 update public.profiles set role=p_role,active=p_approve,access_status=target where id=r.user_id;
 update public.fuel_account_requests set status=target,requested_role=p_role,reviewed_by=p_admin_id,reviewed_at=now(),review_note=left(coalesce(p_note,''),500) where id=r.id;
 return jsonb_build_object('ok',true,'status',target);
end $$;
revoke all on function public.allow_fuel_account_request(text,text),public.submit_fuel_account_request(uuid,text,text,text),public.review_fuel_account_request(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.allow_fuel_account_request(text,text),public.submit_fuel_account_request(uuid,text,text,text),public.review_fuel_account_request(uuid,uuid,boolean,text,text) to service_role;

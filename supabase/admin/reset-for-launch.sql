-- DESTRUCTIVE ONE-TIME RESET, explicitly requested by the project owner.
-- Run manually in SQL Editor of cvgbgwuzhkuinwzlyijt. NEVER add this file to automatic migrations.
-- Deletes customer accounts, rental records, documents, payments, contracts and application logs.
-- Preserves vehicle/partner catalog, project configuration and OCR functions.
-- Browser generation must match src/config/dataEpoch.ts.
begin;

-- Storage objects must be removed using Storage Dashboard/API, never by deleting storage.objects rows.
-- Stop before deleting anything if customer files still exist in the three app buckets.
do $$
begin
  if exists (select 1 from storage.objects where bucket_id in ('documents','handovers','incidents')) then
    raise exception 'Customer files still exist. Empty documents, handovers and incidents in Storage Dashboard first, then rerun this script.';
  end if;
end;
$$;

create table if not exists public.app_reset_state (
  id integer primary key check (id = 1),
  epoch text not null
);
alter table public.app_reset_state enable row level security;
revoke all on public.app_reset_state from public, anon, authenticated;
grant select on public.app_reset_state to anon, authenticated;
drop policy if exists read_reset_generation on public.app_reset_state;
create policy read_reset_generation on public.app_reset_state for select to anon, authenticated using (true);
insert into public.app_reset_state(id, epoch) values (1, 'motocare-fresh-20261111-1')
  on conflict (id) do update set epoch = excluded.epoch;

-- Prevent old browser tabs/outboxes from restoring pre-reset records.
-- This generation header is a compatibility gate, NOT a substitute for authentication or RLS.
create or replace function public.require_current_app_generation()
returns trigger language plpgsql set search_path = public as $$
declare
  request_headers jsonb;
  expected_epoch text;
begin
  if current_user in ('anon','authenticated') then
    request_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    select epoch into expected_epoch from public.app_reset_state where id = 1;
    if expected_epoch is null or request_headers->>'x-motocare-data-epoch' is distinct from expected_epoch then
      raise exception 'Application data was reset. Refresh the website before writing data.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Explicit allowlist; no CASCADE that might erase unrelated tables.
do $$
declare
  target_tables text;
begin
  select string_agg(format('public.%I', tablename), ', ' order by tablename) into target_tables
  from pg_tables where schemaname = 'public' and tablename = any(array[
    'profiles','auth_accounts','rental_requests','customer_documents','payments','contracts',
    'vehicle_schedule','inspections','handovers','damage_findings','statements','settlements',
    'extension_requests','incidents','incident_dispatches','maintenance_orders','notifications',
    'process_events','process_state','timers','integration_logs','ai_logs','audit_logs','ocr_quota'
  ]);
  if target_tables is not null then execute 'truncate table ' || target_tables || ' restart identity'; end if;
end;
$$;

-- App accounts are stored in public.auth_accounts. Clear separate Supabase Auth sessions/users too.
-- Any unexpected Storage ownership or external FK will abort this entire transaction rather than partially delete data.
delete from auth.users;

INSERT INTO public.profiles(id,full_name,role) VALUES ('11111111-1111-4111-8111-111111111111','Qu?n l?','quan_ly');
INSERT INTO public.auth_accounts(user_id,email,password_hash,salt) VALUES ('11111111-1111-4111-8111-111111111111','admin@motocare.vn','fe06dad48c1f2acf2615101548ff31c8c791ec5f04c4fe50bce5e5bee412d298','dd21fcce0056aa63fcc7bae9b49cd199');
INSERT INTO public.profiles(id,full_name,role) VALUES ('22222222-2222-4222-8222-222222222222','Nh?n vi?n 1','nhan_vien');
INSERT INTO public.auth_accounts(user_id,email,password_hash,salt) VALUES ('22222222-2222-4222-8222-222222222222','nhanvien1@motocare.vn','48b5dada47232885f025e730f96101de2d5ae24c3906eebc534675cf073a4bbb','0873c96b10e9d4976dca73866db8bae9');
INSERT INTO public.profiles(id,full_name,role) VALUES ('33333333-3333-4333-8333-333333333333','Nh?n vi?n 2','nhan_vien');
INSERT INTO public.auth_accounts(user_id,email,password_hash,salt) VALUES ('33333333-3333-4333-8333-333333333333','nhanvien2@motocare.vn','e698019345962386a7b242dc186721204d1964ce1757aa83be8cd19cc32fd0f6','22935e84c0a972145f505606c6a551a9');
update public.profiles set full_name = 'Quản lý' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set full_name = 'Nhân viên 1' where id = '22222222-2222-4222-8222-222222222222';
update public.profiles set full_name = 'Nhân viên 2' where id = '33333333-3333-4333-8333-333333333333';

-- Release previously rented vehicles; preserve fleet inventory and vehicles already under maintenance.
update public.vehicles set status = 'SAN_SANG' where status = 'DANG_THUE';

-- No customer payload should remain in audit snapshots created during reset.
truncate table public.audit_logs restart identity;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename = any(array[
    'profiles','auth_accounts','vehicles','partners','rental_requests','customer_documents','payments',
    'contracts','vehicle_schedule','inspections','handovers','damage_findings','statements','settlements',
    'extension_requests','incidents','incident_dispatches','maintenance_orders','notifications',
    'process_events','process_state','timers','integration_logs','ai_logs','audit_logs'
  ]) loop
    execute format('drop trigger if exists require_current_app_generation on public.%I', t.tablename);
    execute format('create trigger require_current_app_generation before insert or update or delete on public.%I for each row execute function public.require_current_app_generation()', t.tablename);
  end loop;
end;
$$;

do $$
begin
  if (select count(*) from public.auth_accounts) <> 3 or
     exists(select 1 from public.auth_accounts where email not in ('admin@motocare.vn','nhanvien1@motocare.vn','nhanvien2@motocare.vn')) or
     (select count(*) from public.profiles) <> 3 then
    raise exception 'Reset validation failed: expected exactly three staff accounts.';
  end if;
end;
$$;
commit;

select email from public.auth_accounts order by email;
select count(*) as customer_accounts from public.profiles where role = 'khach_hang';
select count(*) as rental_requests from public.rental_requests;

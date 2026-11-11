-- supabase/enable_realtime.sql
-- Bật Supabase Realtime (postgres_changes) cho các bảng MOTO CARE.
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor. Chạy lại nhiều lần vẫn an toàn.

do $$
declare
  t text;
  tables text[] := array[
    'profiles','vehicles','rental_requests','customer_documents','payments','contracts',
    'vehicle_schedule','inspections','handovers','damage_findings','statements','settlements',
    'extension_requests','partners','incidents','incident_dispatches','maintenance_orders',
    'notifications','process_events','audit_logs'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kiểm tra: danh sách bảng đã bật Realtime
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

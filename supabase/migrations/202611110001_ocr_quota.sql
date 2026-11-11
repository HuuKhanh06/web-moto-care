-- Atomic limits, including a global budget so rotating anonymous users cannot bypass all limits.
create table if not exists public.ocr_quota (
  bucket text not null,
  window_start timestamptz not null,
  calls integer not null default 0,
  primary key (bucket, window_start)
);
alter table public.ocr_quota enable row level security;
revoke all on public.ocr_quota from anon, authenticated;

create or replace function public.consume_ocr_quota(caller uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  window_time timestamptz := to_timestamp(floor(extract(epoch from now()) / 300) * 300);
  user_calls integer;
  global_calls integer;
begin
  -- A single lock protects both limits and prevents partial charges on rejection.
  perform pg_advisory_xact_lock(73112026);
  select calls into user_calls from public.ocr_quota where bucket = caller::text and window_start = window_time;
  select calls into global_calls from public.ocr_quota where bucket = 'global' and window_start = window_time;
  if coalesce(user_calls, 0) >= 5 or coalesce(global_calls, 0) >= 100 then return false; end if;
  insert into public.ocr_quota(bucket, window_start, calls) values (caller::text, window_time, 1), ('global', window_time, 1)
    on conflict (bucket, window_start) do update set calls = ocr_quota.calls + 1;
  delete from public.ocr_quota where window_start < now() - interval '1 day';
  return true;
end;
$$;
revoke all on function public.consume_ocr_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ocr_quota(uuid) to service_role;

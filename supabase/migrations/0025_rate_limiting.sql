-- ============================================================================
-- Rate limiting for public endpoints, backed by Postgres (not an external
-- service — nothing to pay for, and it's reliable across Vercel's
-- serverless invocations where an in-memory counter would NOT be, since
-- each invocation can land on a different, short-lived lambda instance
-- with its own fresh memory).
--
-- check_rate_limit(bucket_key, max_hits, window_seconds) is a simple
-- fixed-window counter: on each call it purges hits older than the
-- window for that specific bucket, counts what's left, and either
-- records a new hit and returns true, or returns false without
-- recording anything. SECURITY DEFINER + granted to anon since the
-- whole point is to protect anonymous public endpoints.
-- ============================================================================

create table rate_limit_hits (
  id bigserial primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_hits_bucket_created on rate_limit_hits (bucket_key, created_at);

-- No RLS policies at all — this table is never read/written directly by
-- any client, only through the SECURITY DEFINER function below.
alter table rate_limit_hits enable row level security;

create or replace function check_rate_limit(p_bucket_key text, p_max_hits int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  delete from rate_limit_hits
    where rate_limit_hits.bucket_key = p_bucket_key
      and rate_limit_hits.created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count from rate_limit_hits where rate_limit_hits.bucket_key = p_bucket_key;

  if v_count >= p_max_hits then
    return false;
  end if;

  insert into rate_limit_hits (bucket_key) values (p_bucket_key);
  return true;
end;
$$;

grant execute on function check_rate_limit(text, int, int) to anon, authenticated;

-- Belt-and-braces cleanup for buckets that stop being hit (the per-bucket
-- delete above only ever cleans a bucket when THAT bucket is checked
-- again) — reuses the same pg_cron extension expire_stale_reservations
-- already depends on.
select cron.schedule(
  'cleanup-rate-limit-hits',
  '0 * * * *',
  $$delete from rate_limit_hits where created_at < now() - interval '1 hour'$$
);

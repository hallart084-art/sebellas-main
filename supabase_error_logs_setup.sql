-- Run this SQL in Supabase SQL Editor to setup error logging.

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  error_message text not null,
  ai_model text not null default '',
  prompt_style text not null default '',
  origin text not null default 'web',
  error_details text,
  username text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint uq_app_error_logs_msg_model unique(error_message, ai_model, prompt_style, origin)
);

alter table public.app_error_logs enable row level security;
revoke all on public.app_error_logs from anon, authenticated;

create or replace function public._validate_active_session(
  p_username text,
  p_session_token text
)
returns table(valid boolean, role text)
language sql
security definer
set search_path = public
as $fn$
  select
    (u.username is not null) as valid,
    u.role::text as role
  from public.auth_users u
  where lower(u.username) = lower(p_username)
    and u.is_active = true
    and (
      coalesce(u.session_token, '') = coalesce(p_session_token, '') 
      or 
      coalesce(u.ext_session_token, '') = coalesce(p_session_token, '')
    )
  limit 1;
$fn$;

create or replace function public.log_app_error_v1(
  p_error_message text,
  p_ai_model text,
  p_error_details text,
  p_username text,
  p_session_token text,
  p_prompt_style text default '',
  p_origin text default 'web'
)
returns table(success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
  v_lower_msg text;
  v_log_id uuid;
  v_occurrences integer;
  v_ai_model text := coalesce(p_ai_model, '');
  v_origin text := coalesce(p_origin, 'web');
begin
  select valid into v_valid
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select false;
    return;
  end if;

  v_lower_msg := lower(p_error_message);
  if v_lower_msg like '%429%' or v_lower_msg like '%quota%' or v_lower_msg like '%exhausted%' or v_lower_msg like '%limit%' or v_lower_msg like '%too many requests%' then
    return query select true;
    return;
  end if;

  insert into public.app_error_logs (
    error_message, ai_model, prompt_style, origin, error_details, username, occurrences, last_seen_at
  ) values (
    p_error_message, v_ai_model, p_prompt_style, v_origin, p_error_details, p_username, 1, now()
  )
  on conflict on constraint uq_app_error_logs_msg_model do update
  set 
    occurrences = public.app_error_logs.occurrences + 1,
    last_seen_at = now()
  returning id, occurrences into v_log_id, v_occurrences;

  return query select true;
end;
$$;

create or replace function public.list_app_errors_v1(
  p_username text,
  p_session_token text,
  p_limit integer default 100
)
returns table(
  id uuid,
  error_message text,
  ai_model text,
  prompt_style text,
  origin text,
  error_details text,
  username text,
  occurrences integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
  v_role text;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then return; end if;
  if v_role not in ('admin', 'superadmin') then return; end if;

  return query
    select e.id, e.error_message, e.ai_model, e.prompt_style, e.origin, e.error_details, e.username, e.occurrences, e.first_seen_at, e.last_seen_at
    from public.app_error_logs e
    order by e.last_seen_at desc
    limit coalesce(p_limit, 100);
end;
$$;

grant execute on function public.log_app_error_v1(text,text,text,text,text,text,text) to anon;
grant execute on function public.list_app_errors_v1(text,text,integer) to anon;

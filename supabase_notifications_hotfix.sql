-- HOTFIX: bootstrap notifications table + recreate RPC functions with stable p_* signatures.
-- Run this as ONE full query block in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'error')),
  target text not null default 'single_user' check (target in ('all', 'single_user')),
  recipient_username text not null,
  created_by text not null,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.app_notifications
  add column if not exists dispatch_id uuid;

update public.app_notifications
set dispatch_id = gen_random_uuid()
where dispatch_id is null;

alter table public.app_notifications
  alter column dispatch_id set default gen_random_uuid();

alter table public.app_notifications
  alter column dispatch_id set not null;

alter table public.app_notifications
  add column if not exists target text;

with dispatch_stats as (
  select
    dispatch_id,
    count(distinct lower(recipient_username)) as recipient_count
  from public.app_notifications
  group by dispatch_id
)
update public.app_notifications n
set target = case
  when dispatch_stats.recipient_count > 1 then 'all'
  else 'single_user'
end
from dispatch_stats
where n.dispatch_id = dispatch_stats.dispatch_id
  and (n.target is null or n.target not in ('all', 'single_user'));

alter table public.app_notifications
  alter column target set default 'single_user';

alter table public.app_notifications
  alter column target set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_notifications_target_check'
      and conrelid = 'public.app_notifications'::regclass
  ) then
    alter table public.app_notifications
      add constraint app_notifications_target_check check (target in ('all', 'single_user'));
  end if;
end $$;

with ranked_notifications as (
  select
    id,
    row_number() over (
      partition by dispatch_id, lower(recipient_username)
      order by is_read desc, created_at asc, id asc
    ) as rn
  from public.app_notifications
)
delete from public.app_notifications n
using ranked_notifications r
where n.id = r.id
  and r.rn > 1;

create index if not exists idx_app_notifications_recipient_created
  on public.app_notifications (recipient_username, created_at desc);

create index if not exists idx_app_notifications_recipient_unread
  on public.app_notifications (recipient_username, is_read);

create index if not exists idx_app_notifications_dispatch
  on public.app_notifications (dispatch_id);

create index if not exists idx_app_notifications_target_dispatch
  on public.app_notifications (target, dispatch_id);

create unique index if not exists uq_app_notifications_dispatch_recipient
  on public.app_notifications (dispatch_id, lower(recipient_username));

alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from anon, authenticated;

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
    and coalesce(u.session_token, '') = coalesce(p_session_token, '')
  limit 1;
$fn$;

create or replace function public._ensure_broadcast_notifications_for_user(
  p_username text
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inserted integer := 0;
begin
  insert into public.app_notifications (
    dispatch_id,
    title,
    message,
    kind,
    target,
    recipient_username,
    created_by,
    is_read,
    read_at,
    created_at
  )
  select
    source.dispatch_id,
    source.title,
    source.message,
    source.kind,
    'all',
    p_username,
    source.created_by,
    false,
    null,
    source.created_at
  from (
    select distinct on (n.dispatch_id)
      n.dispatch_id,
      n.title,
      n.message,
      n.kind,
      n.created_by,
      n.created_at
    from public.app_notifications n
    where n.target = 'all'
    order by n.dispatch_id, n.created_at asc, n.id asc
  ) source
  where not exists (
    select 1
    from public.app_notifications existing
    where existing.dispatch_id = source.dispatch_id
      and lower(existing.recipient_username) = lower(p_username)
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$fn$;

create or replace function public.list_my_notifications_v1(
  p_username text,
  p_session_token text,
  p_limit_count integer default 20,
  p_before_created_at timestamptz default null
)
returns setof public.app_notifications
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
begin
  select valid into v_valid
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return;
  end if;

  perform public._ensure_broadcast_notifications_for_user(p_username);

  return query
    select n.*
    from public.app_notifications n
    where lower(n.recipient_username) = lower(p_username)
      and (p_before_created_at is null or n.created_at < p_before_created_at)
    order by n.created_at desc
    limit greatest(1, least(coalesce(p_limit_count, 20), 100));
end;
$fn$;

create or replace function public.list_my_unread_count_v1(
  p_username text,
  p_session_token text
)
returns table(unread_count integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
begin
  select valid into v_valid
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select 0;
    return;
  end if;

  perform public._ensure_broadcast_notifications_for_user(p_username);

  return query
    select count(*)::integer
    from public.app_notifications n
    where lower(n.recipient_username) = lower(p_username)
      and n.is_read = false;
end;
$fn$;

create or replace function public.mark_notification_read_v1(
  p_username text,
  p_session_token text,
  p_notification_id uuid
)
returns table(success boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_updated integer := 0;
begin
  select valid into v_valid
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select false;
    return;
  end if;

  update public.app_notifications n
  set
    is_read = true,
    read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and lower(n.recipient_username) = lower(p_username);

  get diagnostics v_updated = row_count;
  return query select (v_updated > 0);
end;
$fn$;

create or replace function public.mark_all_notifications_read_v1(
  p_username text,
  p_session_token text
)
returns table(updated_count integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_updated integer := 0;
begin
  select valid into v_valid
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select 0;
    return;
  end if;

  update public.app_notifications n
  set
    is_read = true,
    read_at = coalesce(n.read_at, now())
  where lower(n.recipient_username) = lower(p_username)
    and n.is_read = false;

  get diagnostics v_updated = row_count;
  return query select v_updated;
end;
$fn$;

create or replace function public.send_notification_v1(
  p_sender_username text,
  p_sender_session_token text,
  p_title text,
  p_message text,
  p_target text,
  p_recipient_username text default null,
  p_kind text default 'info'
)
returns table(success boolean, inserted_count integer, error text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_role text;
  v_inserted integer := 0;
  v_dispatch_id uuid := gen_random_uuid();
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_sender_username, p_sender_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select false, 0, 'Invalid session';
    return;
  end if;

  if v_role not in ('admin', 'superadmin') then
    return query select false, 0, 'Insufficient role';
    return;
  end if;

  if p_target = 'all' then
    insert into public.app_notifications (dispatch_id, title, message, kind, target, recipient_username, created_by)
    select v_dispatch_id, p_title, p_message, coalesce(p_kind, 'info'), 'all', u.username, p_sender_username
    from public.auth_users u
    where u.is_active = true;

    get diagnostics v_inserted = row_count;
    return query select true, v_inserted, null::text;
    return;
  end if;

  if p_target = 'single_user' then
    if p_recipient_username is null or btrim(p_recipient_username) = '' then
      return query select false, 0, 'recipient_username is required for single_user';
      return;
    end if;

    insert into public.app_notifications (dispatch_id, title, message, kind, target, recipient_username, created_by)
    select v_dispatch_id, p_title, p_message, coalesce(p_kind, 'info'), 'single_user', u.username, p_sender_username
    from public.auth_users u
    where lower(u.username) = lower(p_recipient_username)
      and u.is_active = true;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return query select false, 0, 'Recipient not found or inactive';
      return;
    end if;

    return query select true, v_inserted, null::text;
    return;
  end if;

  return query select false, 0, 'Invalid target';
end;
$fn$;

create or replace function public.list_sent_notifications_v1(
  p_sender_username text,
  p_sender_session_token text,
  p_limit_count integer default 30,
  p_before_created_at timestamptz default null
)
returns table(
  dispatch_id uuid,
  title text,
  message text,
  kind text,
  created_by text,
  created_at timestamptz,
  recipient_count integer,
  read_count integer,
  unread_count integer
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_role text;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_sender_username, p_sender_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return;
  end if;

  if v_role not in ('admin', 'superadmin') then
    return;
  end if;

  return query
    select
      n.dispatch_id,
      min(n.title)::text as title,
      min(n.message)::text as message,
      min(n.kind)::text as kind,
      min(n.created_by)::text as created_by,
      max(n.created_at) as created_at,
      count(*)::integer as recipient_count,
      count(*) filter (where n.is_read = true)::integer as read_count,
      count(*) filter (where n.is_read = false)::integer as unread_count
    from public.app_notifications n
    where lower(n.created_by) = lower(p_sender_username)
      and (p_before_created_at is null or n.created_at < p_before_created_at)
    group by n.dispatch_id
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit_count, 30), 100));
end;
$fn$;

create or replace function public.update_sent_notification_v1(
  p_sender_username text,
  p_sender_session_token text,
  p_dispatch_id uuid,
  p_title text,
  p_message text,
  p_kind text
)
returns table(success boolean, updated_count integer, error text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_role text;
  v_updated integer := 0;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_sender_username, p_sender_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select false, 0, 'Invalid session';
    return;
  end if;

  if v_role not in ('admin', 'superadmin') then
    return query select false, 0, 'Insufficient role';
    return;
  end if;

  if p_kind not in ('info', 'success', 'warning', 'error') then
    return query select false, 0, 'Invalid kind';
    return;
  end if;

  update public.app_notifications n
  set
    title = p_title,
    message = p_message,
    kind = p_kind
  where n.dispatch_id = p_dispatch_id
    and lower(n.created_by) = lower(p_sender_username);

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return query select false, 0, 'Notification not found';
    return;
  end if;

  return query select true, v_updated, null::text;
end;
$fn$;

create or replace function public.delete_sent_notification_v1(
  p_sender_username text,
  p_sender_session_token text,
  p_dispatch_id uuid
)
returns table(success boolean, deleted_count integer, error text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_valid boolean;
  v_role text;
  v_deleted integer := 0;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_sender_username, p_sender_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then
    return query select false, 0, 'Invalid session';
    return;
  end if;

  if v_role not in ('admin', 'superadmin') then
    return query select false, 0, 'Insufficient role';
    return;
  end if;

  delete from public.app_notifications n
  where n.dispatch_id = p_dispatch_id
    and lower(n.created_by) = lower(p_sender_username);

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return query select false, 0, 'Notification not found';
    return;
  end if;

  return query select true, v_deleted, null::text;
end;
$fn$;

grant execute on function public.list_my_notifications_v1(text,text,integer,timestamptz) to anon;
grant execute on function public.list_my_unread_count_v1(text,text) to anon;
grant execute on function public.mark_notification_read_v1(text,text,uuid) to anon;
grant execute on function public.mark_all_notifications_read_v1(text,text) to anon;
grant execute on function public.send_notification_v1(text,text,text,text,text,text,text) to anon;
grant execute on function public.list_sent_notifications_v1(text,text,integer,timestamptz) to anon;
grant execute on function public.update_sent_notification_v1(text,text,uuid,text,text,text) to anon;
grant execute on function public.delete_sent_notification_v1(text,text,uuid) to anon;

notify pgrst, 'reload schema';

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'send_notification_v1',
    'list_my_notifications_v1',
    'list_my_unread_count_v1',
    'mark_notification_read_v1',
    'mark_all_notifications_read_v1',
    'list_sent_notifications_v1',
    'update_sent_notification_v1',
    'delete_sent_notification_v1'
  )
order by p.proname;

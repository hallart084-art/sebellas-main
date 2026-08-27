-- Run this SQL in Supabase SQL Editor to add delete functionality to error logs.

create or replace function public.delete_app_error_v1(
  p_username text,
  p_session_token text,
  p_error_id uuid
)
returns table(success boolean)
language plpgsql
security definer
set search_path = public
as $`$
declare
  v_valid boolean;
  v_role text;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then 
    return query select false;
    return;
  end if;
  if v_role not in ('admin', 'superadmin') then 
    return query select false;
    return;
  end if;

  delete from public.app_error_logs where id = p_error_id;

  return query select true;
end;
$`$;

create or replace function public.clear_all_app_errors_v1(
  p_username text,
  p_session_token text
)
returns table(success boolean)
language plpgsql
security definer
set search_path = public
as $`$
declare
  v_valid boolean;
  v_role text;
begin
  select valid, role into v_valid, v_role
  from public._validate_active_session(p_username, p_session_token)
  limit 1;

  if coalesce(v_valid, false) = false then 
    return query select false;
    return;
  end if;
  if v_role not in ('admin', 'superadmin') then 
    return query select false;
    return;
  end if;

  -- Use WHERE id IS NOT NULL to bypass pg_safeupdate restrictions
  delete from public.app_error_logs where id is not null;

  return query select true;
end;
$`$;

grant execute on function public.delete_app_error_v1(text,text,uuid) to anon;
grant execute on function public.clear_all_app_errors_v1(text,text) to anon;


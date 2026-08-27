-- Run this in Supabase SQL Editor to verify RPC signatures and refresh PostgREST cache.

select
  n.nspname as schema_name,
  p.proname as function_name,
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

-- refresh schema cache for RPC discovery
notify pgrst, 'reload schema';

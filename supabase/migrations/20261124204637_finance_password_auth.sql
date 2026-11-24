create function public.finance_password_session() returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt()->>'email', '') is not null
    and (auth.jwt()->'app_metadata'->'providers') @> '["email"]'::jsonb
    and (auth.jwt()->'amr') @> '[{"method":"password"}]'::jsonb
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false), false
  )
$$;
revoke execute on function public.finance_password_session() from public, anon;
grant execute on function public.finance_password_session() to authenticated;

do $$
declare
  entity text;
begin
  foreach entity in array array[
    'categories', 'accounts', 'transactions', 'recurring_transactions', 'recurrence_exceptions',
    'credit_cards', 'credit_card_purchases', 'credit_card_invoices', 'user_settings'
  ] loop
    execute format(
      'alter policy owner_google_access on public.%I
       using (user_id = (select auth.uid()) and (select public.finance_password_session()))
       with check (user_id = (select auth.uid()) and (select public.finance_password_session()))', entity
    );
    execute format('alter policy owner_google_access on public.%I rename to owner_password_access', entity);
  end loop;
end;
$$;

revoke execute on function public.finance_google_session() from authenticated;
drop function public.finance_google_session();

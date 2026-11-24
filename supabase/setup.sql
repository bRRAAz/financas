-- Execute em um banco sem o esquema do aplicativo. Este arquivo consolida as migrations.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('income', 'expense')),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'tag',
  active boolean not null default true,
  unique (user_id, kind, name),
  unique (user_id, id, kind)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  opening_balance integer not null,
  opening_date date not null,
  active boolean not null default true
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount integer not null check (amount > 0),
  category_id uuid,
  account_id uuid,
  destination_id uuid,
  method text not null default '',
  notes text not null default '',
  planned_date date not null,
  effective_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'received', 'cancelled')),
  check ((status in ('paid', 'received')) = (effective_date is not null)),
  check (status <> 'received' or kind = 'income'),
  check (status <> 'paid' or kind <> 'income'),
  foreign key (user_id, category_id, kind) references public.categories(user_id, id, kind),
  foreign key (user_id, account_id) references public.accounts(user_id, id),
  foreign key (user_id, destination_id) references public.accounts(user_id, id),
  check (
    (kind = 'transfer' and account_id is not null and destination_id is not null and account_id <> destination_id and category_id is null)
    or (kind <> 'transfer' and destination_id is null)
  )
);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount integer not null check (amount > 0),
  category_id uuid,
  account_id uuid,
  destination_id uuid,
  method text not null default '',
  notes text not null default '',
  start_date date not null,
  end_date date check (end_date >= start_date),
  repeat_count integer check (repeat_count between 1 and 10000),
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')),
  active boolean not null default true,
  stop_before date,
  anchor_day smallint check (anchor_day between 1 and 31),
  superseded boolean not null default false,
  foreign key (user_id, category_id, kind) references public.categories(user_id, id, kind),
  foreign key (user_id, account_id) references public.accounts(user_id, id),
  foreign key (user_id, destination_id) references public.accounts(user_id, id),
  check (
    (kind = 'transfer' and account_id is not null and destination_id is not null and account_id <> destination_id and category_id is null)
    or (kind <> 'transfer' and destination_id is null)
  )
);

create table public.recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount integer not null check (amount > 0),
  category_id uuid,
  account_id uuid,
  destination_id uuid,
  method text not null default '',
  notes text not null default '',
  planned_date date not null,
  effective_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'received', 'cancelled')),
  check ((status in ('paid', 'received')) = (effective_date is not null)),
  check (status <> 'received' or kind = 'income'),
  check (status <> 'paid' or kind <> 'income'),
  recurrence_id uuid not null,
  occurrence_date date not null,
  unique (user_id, recurrence_id, occurrence_date),
  foreign key (user_id, recurrence_id) references public.recurring_transactions(user_id, id) on delete cascade,
  foreign key (user_id, category_id, kind) references public.categories(user_id, id, kind),
  foreign key (user_id, account_id) references public.accounts(user_id, id),
  foreign key (user_id, destination_id) references public.accounts(user_id, id),
  check (
    (kind = 'transfer' and account_id is not null and destination_id is not null and account_id <> destination_id and category_id is null)
    or (kind <> 'transfer' and destination_id is null)
  )
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  institution text not null default '',
  credit_limit integer check (credit_limit > 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  last_four text not null default '' check (last_four ~ '^([0-9]{4})?$'),
  active boolean not null default true
);

create table public.credit_card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  amount integer not null,
  purchase_date date not null,
  category_id uuid,
  category_kind text generated always as ('expense'::text) stored,
  card_id uuid not null,
  installments smallint not null check (installments between 1 and 120),
  first_number smallint not null check (first_number between 1 and installments),
  first_month date not null check (extract(day from first_month) = 1),
  notes text not null default '',
  check (amount >= installments),
  foreign key (user_id, card_id) references public.credit_cards(user_id, id),
  foreign key (user_id, category_id, category_kind) references public.categories(user_id, id, kind)
);

create table public.credit_card_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  card_id uuid not null,
  month date not null check (extract(day from month) = 1),
  manual_amount integer check (manual_amount >= 0),
  reconciled boolean not null default false,
  paid_date date,
  paid_amount integer check (paid_amount > 0),
  closing_date date,
  due_date date,
  account_id uuid,
  unique (user_id, card_id, month),
  check ((paid_date is null) = (paid_amount is null)),
  check ((closing_date is null) = (due_date is null)),
  check (closing_date < due_date),
  foreign key (user_id, card_id) references public.credit_cards(user_id, id),
  foreign key (user_id, account_id) references public.accounts(user_id, id)
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_planned on public.transactions(user_id, planned_date);
create index transactions_effective on public.transactions(user_id, effective_date) where effective_date is not null;
create index recurrences_start on public.recurring_transactions(user_id, start_date);
create index recurrence_exceptions_planned on public.recurrence_exceptions(user_id, planned_date);
create index purchases_card_month on public.credit_card_purchases(user_id, card_id, first_month);
create index invoices_month on public.credit_card_invoices(user_id, month);
create index transactions_category_id_idx on public.transactions(user_id, category_id);
create index transactions_account_id_idx on public.transactions(user_id, account_id);
create index transactions_destination_id_idx on public.transactions(user_id, destination_id);
create index recurring_transactions_category_id_idx on public.recurring_transactions(user_id, category_id);
create index recurring_transactions_account_id_idx on public.recurring_transactions(user_id, account_id);
create index recurring_transactions_destination_id_idx on public.recurring_transactions(user_id, destination_id);
create index recurrence_exceptions_category_id_idx on public.recurrence_exceptions(user_id, category_id);
create index recurrence_exceptions_account_id_idx on public.recurrence_exceptions(user_id, account_id);
create index recurrence_exceptions_destination_id_idx on public.recurrence_exceptions(user_id, destination_id);
create index purchases_category_idx on public.credit_card_purchases(user_id, category_id);
create index invoices_account_idx on public.credit_card_invoices(user_id, account_id);

create function public.finance_google_session() returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->'providers') @> '["google"]'::jsonb
    and (auth.jwt()->'app_metadata'->'providers') <@ '["google","email"]'::jsonb
    and (auth.jwt()->'amr') @> '[{"method":"oauth"}]'::jsonb
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false), false
  )
$$;
revoke execute on function public.finance_google_session() from public, anon;
grant execute on function public.finance_google_session() to authenticated;

create function public.finance_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.finance_updated_at() from public, anon, authenticated;

do $$
declare
  entity text;
begin
  foreach entity in array array[
    'categories', 'accounts', 'transactions', 'recurring_transactions', 'recurrence_exceptions',
    'credit_cards', 'credit_card_purchases', 'credit_card_invoices', 'user_settings'
  ] loop
    execute format('alter table public.%I enable row level security', entity);
    execute format('revoke all on public.%I from public, anon, authenticated', entity);
    execute format('grant select, insert, update, delete on public.%I to authenticated', entity);
    execute format(
      'create policy owner_google_access on public.%I for all to authenticated
       using (user_id = (select auth.uid()) and (select public.finance_google_session()))
       with check (user_id = (select auth.uid()) and (select public.finance_google_session()))', entity
    );
    execute format(
      'create trigger finance_updated_at before update on public.%I
       for each row execute function public.finance_updated_at()', entity
    );
  end loop;
end;
$$;

create function public.initialize_finance() returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.user_settings default values on conflict (user_id) do nothing;
  if found then
    insert into public.categories(name, kind, color, icon) values
      ('Moradia', 'expense', '#7368cf', 'house'),
      ('Alimentação', 'expense', '#ed984c', 'utensils'),
      ('Transporte', 'expense', '#4590ef', 'car'),
      ('Saúde', 'expense', '#db6277', 'heart'),
      ('Educação', 'expense', '#727ae1', 'book'),
      ('Lazer', 'expense', '#c078c8', 'sparkles'),
      ('Compras', 'expense', '#60a5c7', 'bag'),
      ('Assinaturas', 'expense', '#64748b', 'repeat'),
      ('Investimentos', 'expense', '#1b9875', 'chart'),
      ('Outros', 'expense', '#8895a8', 'tag'),
      ('Salário', 'income', '#169475', 'wallet'),
      ('Renda extra', 'income', '#559bd9', 'briefcase'),
      ('Rendimentos', 'income', '#1b9875', 'chart'),
      ('Reembolsos', 'income', '#c09443', 'repeat'),
      ('Outros', 'income', '#8895a8', 'tag')
    on conflict (user_id, kind, name) do nothing;
  end if;
end;
$$;
revoke execute on function public.initialize_finance() from public, anon;
grant execute on function public.initialize_finance() to authenticated;

create function public.split_finance_recurrence(old_id uuid, cutoff date, replacement jsonb, new_dates jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  previous public.recurring_transactions;
  next_rule public.recurring_transactions;
begin
  select * into strict previous from public.recurring_transactions where id = old_id for update;
  if cutoff < previous.start_date or (previous.stop_before is not null and
     (cutoff > previous.stop_before or (cutoff = previous.stop_before and previous.superseded))) then
    raise exception 'A recorrência foi alterada. Atualize a página e tente novamente.';
  end if;

  next_rule := jsonb_populate_record(null::public.recurring_transactions, replacement);
  update public.recurring_transactions set active = false, stop_before = cutoff, superseded = true where id = old_id;
  insert into public.recurring_transactions
    (id, description, kind, amount, category_id, account_id, destination_id, method, notes,
     start_date, end_date, repeat_count, frequency, active, stop_before, anchor_day)
  values
    (next_rule.id, next_rule.description, next_rule.kind, next_rule.amount, next_rule.category_id,
     next_rule.account_id, next_rule.destination_id, next_rule.method, next_rule.notes, next_rule.start_date,
     next_rule.end_date, next_rule.repeat_count, next_rule.frequency, next_rule.active, next_rule.stop_before, next_rule.anchor_day);

  update public.recurrence_exceptions as e
  set recurrence_id = next_rule.id, occurrence_date = (new_dates ->> (e.occurrence_date::text))::date
  where e.recurrence_id = old_id and e.occurrence_date >= cutoff
    and (new_dates ->> (e.occurrence_date::text)) is not null;

  update public.recurrence_exceptions as e set status = 'cancelled'
  where e.recurrence_id = old_id and e.occurrence_date >= cutoff and e.status = 'pending';
end;
$$;
revoke execute on function public.split_finance_recurrence(uuid, date, jsonb, jsonb) from public, anon;
grant execute on function public.split_finance_recurrence(uuid, date, jsonb, jsonb) to authenticated;

create index transactions_category_fk_idx on public.transactions(user_id, category_id, kind);
create index recurring_transactions_category_fk_idx on public.recurring_transactions(user_id, category_id, kind);
create index recurrence_exceptions_category_fk_idx on public.recurrence_exceptions(user_id, category_id, kind);
create index purchases_category_fk_idx on public.credit_card_purchases(user_id, category_id, category_kind);

drop index public.transactions_category_id_idx;
drop index public.recurring_transactions_category_id_idx;
drop index public.recurrence_exceptions_category_id_idx;
drop index public.purchases_category_idx;

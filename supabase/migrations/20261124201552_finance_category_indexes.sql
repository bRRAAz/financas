create index transactions_category_fk_idx on public.transactions(user_id, category_id, kind);
create index recurring_transactions_category_fk_idx on public.recurring_transactions(user_id, category_id, kind);
create index recurrence_exceptions_category_fk_idx on public.recurrence_exceptions(user_id, category_id, kind);
create index purchases_category_fk_idx on public.credit_card_purchases(user_id, category_id, category_kind);

drop index public.transactions_category_id_idx;
drop index public.recurring_transactions_category_id_idx;
drop index public.recurrence_exceptions_category_id_idx;
drop index public.purchases_category_idx;

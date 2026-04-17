create or replace view public.vw_transaction_summary
with (security_invoker = true) as
select
  telegram_user_id,
  coalesce(sum(case when type = 'income' then amount else 0 end), 0)::numeric as total_income,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::numeric as total_expense,
  coalesce(sum(case when type = 'income' then amount else -amount end), 0)::numeric as ending_balance
from public.transactions
group by telegram_user_id;

grant select on table public.vw_transaction_summary to anon, authenticated;

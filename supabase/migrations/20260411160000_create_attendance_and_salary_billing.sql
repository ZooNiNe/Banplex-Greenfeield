create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  telegram_user_id text,
  team_id uuid,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text,
  team_id uuid,
  worker_id uuid not null references public.workers(id),
  project_id uuid not null references public.projects(id),
  attendance_date date not null default current_date,
  attendance_status text not null default 'full_day',
  total_pay numeric not null default 0,
  entry_mode text not null default 'manual',
  billing_status text not null default 'unbilled',
  salary_bill_id uuid references public.bills(id) on delete set null,
  notes text,
  created_at timestamp with time zone not null default now(),
  constraint attendance_records_attendance_status_check
    check (attendance_status in ('full_day', 'half_day', 'overtime')),
  constraint attendance_records_billing_status_check
    check (billing_status in ('unbilled', 'billed'))
);

alter table public.bills
  add column if not exists worker_id uuid references public.workers(id);

create index if not exists idx_attendance_records_billing_status
  on public.attendance_records (billing_status);

create index if not exists idx_attendance_records_worker_id
  on public.attendance_records (worker_id);

create index if not exists idx_attendance_records_telegram_user_id
  on public.attendance_records (telegram_user_id);

create or replace function public.fn_generate_salary_bill(
  p_worker_id uuid,
  p_record_ids uuid[],
  p_total_amount numeric,
  p_due_date date,
  p_description text
)
returns uuid
language plpgsql
as $$
declare
  new_bill_id uuid;
  v_telegram_user_id text;
  v_team_id uuid;
  v_updated_count integer;
begin
  if p_worker_id is null then
    raise exception 'Worker ID wajib diisi.';
  end if;

  if coalesce(array_length(p_record_ids, 1), 0) = 0 then
    raise exception 'Minimal satu absensi harus dipilih.';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Total amount harus lebih dari 0.';
  end if;

  select
    max(telegram_user_id),
    max(team_id)
  into
    v_telegram_user_id,
    v_team_id
  from public.attendance_records
  where id = any(p_record_ids)
    and worker_id = p_worker_id;

  if v_telegram_user_id is null then
    raise exception 'Data absensi tidak ditemukan untuk pekerja ini.';
  end if;

  insert into public.bills (
    worker_id,
    bill_type,
    status,
    amount,
    paid_amount,
    due_date,
    description,
    telegram_user_id,
    team_id
  )
  values (
    p_worker_id,
    'gaji',
    'unpaid',
    p_total_amount,
    0,
    p_due_date,
    coalesce(nullif(btrim(p_description), ''), 'Tagihan gaji'),
    v_telegram_user_id,
    v_team_id
  )
  returning id into new_bill_id;

  update public.attendance_records
  set
    salary_bill_id = new_bill_id,
    billing_status = 'billed'
  where id = any(p_record_ids)
    and worker_id = p_worker_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0 then
    raise exception 'Tidak ada absensi yang berhasil dibundel.';
  end if;

  return new_bill_id;
end;
$$;

grant execute on function public.fn_generate_salary_bill(uuid, uuid[], numeric, date, text) to anon, authenticated;
grant select, insert, update on table public.workers to anon, authenticated;
grant select, insert, update on table public.attendance_records to anon, authenticated;
grant select, insert, update on table public.bills to anon, authenticated;

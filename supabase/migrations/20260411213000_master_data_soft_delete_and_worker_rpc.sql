begin;

alter table public.projects add column if not exists deleted_at timestamptz;
alter table public.suppliers add column if not exists deleted_at timestamptz;
alter table public.expense_categories add column if not exists deleted_at timestamptz;
alter table public.funding_creditors add column if not exists deleted_at timestamptz;
alter table public.professions add column if not exists deleted_at timestamptz;
alter table public.workers add column if not exists deleted_at timestamptz;
alter table public.staff add column if not exists deleted_at timestamptz;
alter table public.worker_wage_rates add column if not exists deleted_at timestamptz;

drop index if exists public.projects_team_project_name_key;
create unique index if not exists projects_team_project_name_key
  on public.projects(team_id, project_name)
  where deleted_at is null;

drop index if exists public.suppliers_team_supplier_name_type_key;
create unique index if not exists suppliers_team_supplier_name_type_key
  on public.suppliers(team_id, supplier_name, supplier_type)
  where deleted_at is null;

drop index if exists public.expense_categories_team_group_name_key;
create unique index if not exists expense_categories_team_group_name_key
  on public.expense_categories(team_id, category_group, name)
  where deleted_at is null;

drop index if exists public.funding_creditors_team_creditor_name_key;
create unique index if not exists funding_creditors_team_creditor_name_key
  on public.funding_creditors(team_id, creditor_name)
  where deleted_at is null;

drop index if exists public.professions_team_profession_name_key;
create unique index if not exists professions_team_profession_name_key
  on public.professions(team_id, profession_name)
  where deleted_at is null;

drop index if exists public.workers_team_worker_name_key;
create unique index if not exists workers_team_worker_name_key
  on public.workers(team_id, worker_name)
  where deleted_at is null;

drop index if exists public.staff_team_staff_name_key;
create unique index if not exists staff_team_staff_name_key
  on public.staff(team_id, staff_name)
  where deleted_at is null;

drop index if exists public.worker_wage_rates_worker_project_role_key;
create unique index if not exists worker_wage_rates_worker_project_role_key
  on public.worker_wage_rates(worker_id, project_id, role_name)
  where deleted_at is null;

create or replace function public.fn_upsert_worker_with_wages(
  p_worker_id uuid,
  p_team_id uuid,
  p_worker_name text,
  p_telegram_user_id text,
  p_profession_id uuid,
  p_status text,
  p_default_project_id uuid,
  p_default_role_name text,
  p_notes text,
  p_wage_rates jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_worker_id uuid;
  v_rate jsonb;
  v_updated_count integer := 0;
begin
  if p_team_id is null then
    raise exception 'Akses workspace tidak ditemukan.';
  end if;

  if nullif(btrim(coalesce(p_worker_name, '')), '') is null then
    raise exception 'Nama pekerja wajib diisi.';
  end if;

  if p_worker_id is null then
    insert into public.workers (
      team_id,
      name,
      telegram_user_id,
      profession_id,
      status,
      default_project_id,
      default_role_name,
      notes,
      is_active,
      deleted_at
    )
    values (
      p_team_id,
      btrim(p_worker_name),
      nullif(btrim(coalesce(p_telegram_user_id, '')), ''),
      p_profession_id,
      coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'active'),
      p_default_project_id,
      nullif(btrim(coalesce(p_default_role_name, '')), ''),
      nullif(btrim(coalesce(p_notes, '')), ''),
      true,
      null
    )
    returning id into v_worker_id;
  else
    update public.workers
    set
      name = btrim(p_worker_name),
      telegram_user_id = nullif(btrim(coalesce(p_telegram_user_id, '')), ''),
      profession_id = p_profession_id,
      status = coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'active'),
      default_project_id = p_default_project_id,
      default_role_name = nullif(btrim(coalesce(p_default_role_name, '')), ''),
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      deleted_at = null,
      is_active = true
    where id = p_worker_id
      and team_id = p_team_id;

    get diagnostics v_updated_count = row_count;

    if v_updated_count = 0 then
      raise exception 'Pekerja tidak ditemukan atau tidak dapat diubah.';
    end if;

    v_worker_id := p_worker_id;
  end if;

  update public.worker_wage_rates
  set deleted_at = now()
  where worker_id = v_worker_id
    and team_id = p_team_id
    and deleted_at is null;

  if jsonb_typeof(coalesce(p_wage_rates, '[]'::jsonb)) <> 'array' then
    raise exception 'Format upah pekerja tidak valid.';
  end if;

  for v_rate in
    select value
    from jsonb_array_elements(coalesce(p_wage_rates, '[]'::jsonb))
  loop
    if nullif(btrim(coalesce(v_rate->>'project_id', '')), '') is null then
      raise exception 'Setiap baris upah harus memiliki proyek.';
    end if;

    if nullif(btrim(coalesce(v_rate->>'role_name', '')), '') is null then
      raise exception 'Setiap baris upah harus memiliki role.';
    end if;

    if nullif(btrim(coalesce(v_rate->>'wage_amount', '')), '') is null
       or (v_rate->>'wage_amount')::numeric <= 0 then
      raise exception 'Setiap baris upah harus memiliki nominal lebih dari 0.';
    end if;

    insert into public.worker_wage_rates (
      team_id,
      worker_id,
      project_id,
      role_name,
      wage_amount,
      is_default,
      deleted_at
    )
    values (
      p_team_id,
      v_worker_id,
      (v_rate->>'project_id')::uuid,
      btrim(v_rate->>'role_name'),
      (v_rate->>'wage_amount')::numeric,
      coalesce((v_rate->>'is_default')::boolean, false),
      null
    );
  end loop;

  return v_worker_id;
end;
$$;

create or replace function public.fn_soft_delete_worker(
  p_worker_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if p_worker_id is null then
    raise exception 'ID pekerja wajib diisi.';
  end if;

  select team_id
  into v_team_id
  from public.workers
  where id = p_worker_id
    and deleted_at is null
  limit 1;

  if v_team_id is null then
    raise exception 'Pekerja tidak ditemukan.';
  end if;

  update public.workers
  set
    deleted_at = now(),
    is_active = false
  where id = p_worker_id
    and deleted_at is null;

  update public.worker_wage_rates
  set deleted_at = now()
  where worker_id = p_worker_id
    and deleted_at is null;
end;
$$;

commit;

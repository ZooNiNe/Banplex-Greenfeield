create table if not exists public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token text not null unique,
  role text not null,
  is_used boolean not null default false,
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint invite_tokens_role_check
    check (role in ('Admin', 'Logistik', 'Payroll', 'Administrasi', 'Viewer'))
);

alter table public.invite_tokens enable row level security;

alter table public.team_members
  add column if not exists status text not null default 'active',
  add column if not exists approved_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.team_members
set
  status = coalesce(nullif(btrim(status), ''), 'active'),
  approved_at = coalesce(approved_at, created_at, now()),
  updated_at = coalesce(updated_at, now())
where status is distinct from coalesce(nullif(btrim(status), ''), 'active')
   or approved_at is null
   or updated_at is null;

alter table public.team_members
  drop constraint if exists team_members_status_check;

alter table public.team_members
  add constraint team_members_status_check
  check (status in ('active', 'suspended'));

create or replace function app_private.set_current_timestamp()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_team_members_set_current_timestamp on public.team_members;
create trigger trg_team_members_set_current_timestamp
before update on public.team_members
for each row
execute function app_private.set_current_timestamp();

create or replace function app_private.has_team_role(
  target_team_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, app_private
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.telegram_user_id = app_private.current_telegram_user_id()
      and tm.status = 'active'
      and (
        allowed_roles is null
        or cardinality(allowed_roles) = 0
        or tm.role = any (allowed_roles)
      )
  )
$$;

create or replace function app_private.can_access_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog, app_private
as $$
  select app_private.has_team_role(target_team_id, null)
$$;

grant execute on function app_private.has_team_role(uuid, text[]) to authenticated;
grant execute on function app_private.can_access_team(uuid) to authenticated;

drop policy if exists team_members_select_own on public.team_members;
create policy team_members_select_own
on public.team_members
for select
to authenticated
using (telegram_user_id = app_private.current_telegram_user_id());

drop policy if exists team_members_select_owner_team on public.team_members;
create policy team_members_select_owner_team
on public.team_members
for select
to authenticated
using (app_private.has_team_role(team_id, array['Owner']));

drop policy if exists team_members_update_owner_team on public.team_members;
create policy team_members_update_owner_team
on public.team_members
for update
to authenticated
using (app_private.has_team_role(team_id, array['Owner']))
with check (app_private.has_team_role(team_id, array['Owner']));

drop policy if exists invite_tokens_select_owner_team on public.invite_tokens;
create policy invite_tokens_select_owner_team
on public.invite_tokens
for select
to authenticated
using (app_private.has_team_role(team_id, array['Owner']));

drop policy if exists invite_tokens_insert_owner_team on public.invite_tokens;
create policy invite_tokens_insert_owner_team
on public.invite_tokens
for insert
to authenticated
with check (
  app_private.has_team_role(team_id, array['Owner'])
  and created_by = auth.uid()
);

drop policy if exists invite_tokens_update_owner_team on public.invite_tokens;
create policy invite_tokens_update_owner_team
on public.invite_tokens
for update
to authenticated
using (app_private.has_team_role(team_id, array['Owner']))
with check (
  app_private.has_team_role(team_id, array['Owner'])
  and created_by = auth.uid()
);

create or replace function public.fn_redeem_invite_token(
  p_token text,
  p_telegram_user_id bigint
)
returns table (
  team_member_id uuid,
  team_id uuid,
  role text,
  status text,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, app_private
as $$
declare
  v_current_telegram_user_id text;
  v_requested_telegram_user_id text;
  v_invite public.invite_tokens%rowtype;
  v_team_member public.team_members%rowtype;
begin
  v_current_telegram_user_id := app_private.current_telegram_user_id();
  v_requested_telegram_user_id := nullif(btrim(p_telegram_user_id::text), '');

  if v_current_telegram_user_id is null then
    raise exception 'Profil Telegram untuk session ini tidak ditemukan.';
  end if;

  if v_requested_telegram_user_id is not null
     and v_requested_telegram_user_id <> v_current_telegram_user_id then
    raise exception 'Token undangan tidak cocok dengan akun Telegram yang sedang aktif.';
  end if;

  select *
  into v_invite
  from public.invite_tokens
  where token = nullif(btrim(coalesce(p_token, '')), '')
  for update;

  if not found then
    raise exception 'Token undangan tidak ditemukan.';
  end if;

  if v_invite.is_used then
    raise exception 'Token undangan sudah pernah digunakan.';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Token undangan sudah kedaluwarsa.';
  end if;

  insert into public.team_members (
    team_id,
    telegram_user_id,
    role,
    is_default,
    status,
    approved_at
  )
  values (
    v_invite.team_id,
    v_current_telegram_user_id,
    v_invite.role,
    false,
    'active',
    now()
  )
  on conflict (team_id, telegram_user_id) do update
    set role = excluded.role,
        status = 'active',
        approved_at = now()
  returning *
  into v_team_member;

  update public.invite_tokens
  set is_used = true
  where id = v_invite.id;

  return query
  select
    v_team_member.id,
    v_team_member.team_id,
    v_team_member.role,
    v_team_member.status,
    v_team_member.approved_at;
end;
$$;

revoke all on function public.fn_redeem_invite_token(text, bigint) from public, anon;
grant execute on function public.fn_redeem_invite_token(text, bigint) to authenticated;

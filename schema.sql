-- SVstockmining: virtual/demo USD wallet schema.
-- Run this in the Supabase SQL Editor for a NEW project.
-- All monetary values are integer cents. No real-money payment rails exist.

create type public.account_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  email text not null,
  status public.account_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  kind text not null check (kind in ('admin_credit')),
  note text not null default 'Admin virtual balance adjustment',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index transactions_user_created_idx on public.transactions(user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name, email, status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Member'),
    new.email,
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;

-- A user can see only their own profile/wallet/ledger. Admin role is set in
-- auth.users.raw_app_meta_data by a trusted SQL Editor operation, never user metadata.
create policy "read own profile or admin"
on public.profiles for select to authenticated
using (id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "read own wallet or admin"
on public.wallets for select to authenticated
using (user_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "read own transactions or admin"
on public.transactions for select to authenticated
using (user_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No client-side insert/update/delete policies are intentionally provided.
-- Registration status and balances can only be changed by guarded RPCs.

create or replace function public.admin_review_registration(target_user uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_status public.account_status;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approve', 'reject') then raise exception 'Invalid decision'; end if;

  select status into current_status from public.profiles where id = target_user for update;
  if not found then raise exception 'Registration not found'; end if;
  if current_status <> 'pending' then raise exception 'This registration has already been reviewed'; end if;

  update public.profiles
    set status = case when decision = 'approve' then 'approved'::public.account_status else 'rejected'::public.account_status end
    where id = target_user;

  if decision = 'approve' then
    insert into public.wallets(user_id, balance_cents) values (target_user, 0)
    on conflict (user_id) do nothing;
  end if;
end;
$$;

create or replace function public.admin_add_virtual_balance(
  target_user uuid, amount_cents bigint, transaction_note text default 'Admin virtual balance adjustment'
)
returns void language plpgsql security definer set search_path = ''
as $$
declare member_status public.account_status;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator access required';
  end if;
  if amount_cents is null or amount_cents <= 0 or amount_cents > 10000000000 then
    raise exception 'Amount is outside the permitted range';
  end if;

  select status into member_status from public.profiles where id = target_user for update;
  if not found or member_status <> 'approved' then
    raise exception 'Only approved members can receive a virtual balance';
  end if;

  insert into public.wallets(user_id, balance_cents)
    values (target_user, amount_cents)
    on conflict (user_id) do update
    set balance_cents = public.wallets.balance_cents + excluded.balance_cents,
        updated_at = now();

  insert into public.transactions(user_id, amount_cents, kind, note, created_by)
    values (target_user, amount_cents, 'admin_credit',
      coalesce(nullif(left(trim(transaction_note), 120), ''), 'Admin virtual balance adjustment'),
      auth.uid());
end;
$$;

revoke all on function public.admin_review_registration(uuid, text) from public;
revoke all on function public.admin_add_virtual_balance(uuid, bigint, text) from public;
grant execute on function public.admin_review_registration(uuid, text) to authenticated;
grant execute on function public.admin_add_virtual_balance(uuid, bigint, text) to authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles, public.wallets, public.transactions to authenticated;

-- FieldQuote — Multi-User Team System
-- Run in the Supabase SQL editor

-- 1. Add account_id and role to profiles
alter table profiles add column if not exists account_id uuid;
alter table profiles add column if not exists role text not null default 'admin';

-- Backfill: existing single users are admins in their own account
update profiles set account_id = user_id where account_id is null;

-- 2. team_members table
create table if not exists team_members (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null,                                          -- admin's user_id
  user_id      uuid references auth.users(id) on delete set null,     -- null until invite accepted
  email        text not null,
  role         text not null default 'member',
  status       text not null default 'pending',                        -- pending | active
  invite_token text unique default gen_random_uuid()::text,
  invited_at   timestamptz not null default now(),
  joined_at    timestamptz,
  constraint uq_team_account_email unique (account_id, email)
);
alter table team_members enable row level security;

-- Admin can fully manage their team (read, insert, update, delete)
create policy "Admin manages own team" on team_members
  for all using (auth.uid() = account_id);

-- Member can read their own invite row
create policy "Member reads own invite" on team_members
  for select using (auth.uid() = user_id);

-- 3. RLS: team members can access the account's documents
create policy "Team member accesses account documents" on documents
  for all using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- 4. RLS: team members can access the account's photos
create policy "Team member accesses account photos" on photos
  for all using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- 5. RLS: team members can read the account's subscription
create policy "Team member reads account subscription" on subscriptions
  for select using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- 6. RLS: team members can read the account owner's profile (for company name / contractor names)
create policy "Team member reads owner profile" on profiles
  for select using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );

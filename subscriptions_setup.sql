-- FieldQuote — Stripe Subscriptions Setup
-- Run in the Supabase SQL editor (run the whole file at once)

-- 1. Subscriptions table
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'trialing',
  trial_end              timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  constraint subscriptions_user_id_key unique (user_id),
  constraint subscriptions_stripe_customer_id_key unique (stripe_customer_id),
  constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id)
);

alter table subscriptions enable row level security;

-- Users can read their own subscription
create policy "Users can view own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Users can insert their own subscription (fallback for pre-trigger users)
create policy "Users can insert own subscription"
  on subscriptions for insert
  with check (auth.uid() = user_id);

-- 2. Force status=trialing on any client-side insert (users can't self-upgrade)
create or replace function enforce_subscription_trial()
returns trigger language plpgsql security definer as $$
begin
  new.status    := 'trialing';
  new.trial_end := coalesce(new.trial_end, now() + interval '30 days');
  return new;
end;
$$;

drop trigger if exists on_subscription_insert_enforce_trial on subscriptions;
create trigger on_subscription_insert_enforce_trial
  before insert on subscriptions
  for each row execute procedure enforce_subscription_trial();

-- 3. Auto-create a trial record when a new user signs up
create or replace function handle_new_user_subscription()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, status, trial_end)
  values (new.id, 'trialing', now() + interval '30 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure handle_new_user_subscription();

-- 4. Backfill: give existing users a 30-day trial from today
insert into public.subscriptions (user_id, status, trial_end)
select id, 'trialing', now() + interval '30 days'
from auth.users
where id not in (select user_id from public.subscriptions)
on conflict (user_id) do nothing;

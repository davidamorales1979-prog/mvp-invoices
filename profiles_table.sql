-- Profiles table: one row per user, stores company info and up to 3 contractor names
create table if not exists profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  name1        text,
  name2        text,
  name3        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Enable row-level security so users can only access their own profile
alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = user_id);

-- Optional: keep updated_at current automatically
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

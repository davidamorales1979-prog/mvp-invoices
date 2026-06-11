-- FieldQuote — Mileage Tracking
create table if not exists mileage_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  doc_id text,
  trip_date date not null default current_date,
  origin text not null default '',
  destination text not null default '',
  miles numeric(8,1) not null default 0,
  purpose text not null default '',
  created_at timestamptz not null default now()
);

alter table mileage_trips enable row level security;

create policy "Users manage own trips" on mileage_trips
  for all using (auth.uid() = user_id);

create policy "Team member accesses account trips" on mileage_trips
  for all using (
    user_id in (
      select account_id from team_members
      where user_id = auth.uid() and status = 'active'
    )
  );

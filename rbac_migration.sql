-- FieldQuote — Role-Based Access Control
-- Adds created_by to documents and account_id to mileage_trips
-- Tightens RLS: owner sees all account docs/trips, member sees only their own

-- 1. Track which user actually created each document
alter table documents add column if not exists created_by uuid;
update documents set created_by = user_id where created_by is null;

-- 2. Track which account each mileage trip belongs to (for owner rollup)
alter table mileage_trips add column if not exists account_id uuid;
update mileage_trips set account_id = user_id where account_id is null;

-- 3. Drop old document policies
drop policy if exists "Users manage own account docs" on documents;
drop policy if exists "Owner manages account docs" on documents;
drop policy if exists "Member reads own docs" on documents;
drop policy if exists "Member inserts own docs" on documents;
drop policy if exists "Member updates own docs" on documents;

-- 4. New document policies
-- Owner: full CRUD on all documents in their account
create policy "Owner manages account docs" on documents
  for all using (auth.uid() = user_id);

-- Member: can read documents they created
create policy "Member reads own docs" on documents
  for select using (auth.uid() = created_by);

-- Member: can insert documents (they create)
create policy "Member inserts own docs" on documents
  for insert with check (auth.uid() = created_by);

-- Member: can update only quotes they created (invoice locking enforced in UI)
create policy "Member updates own docs" on documents
  for update using (auth.uid() = created_by);

-- Note: no member delete policy — only owners can delete

-- 5. Drop old mileage trip policies
drop policy if exists "Users manage own trips" on mileage_trips;
drop policy if exists "Team member accesses account trips" on mileage_trips;
drop policy if exists "Owner sees account trips" on mileage_trips;

-- 6. New mileage trip policies
-- Each user manages their own trips (user_id = their actual user id)
create policy "Users manage own trips" on mileage_trips
  for all using (auth.uid() = user_id);

-- Owner can read all trips in their account across all members
create policy "Owner sees account trips" on mileage_trips
  for select using (auth.uid() = account_id);

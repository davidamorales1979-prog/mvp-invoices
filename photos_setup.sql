-- ============================================================
-- FieldQuote — Photo Gallery Setup
-- Run the entire file in the Supabase SQL editor
-- ============================================================

-- 1. Photos metadata table
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_name  text not null,
  storage_path text not null,
  file_name    text,
  created_at   timestamptz default now()
);

alter table photos enable row level security;

create policy "Users can view own photos"
  on photos for select using (auth.uid() = user_id);

create policy "Users can insert own photos"
  on photos for insert with check (auth.uid() = user_id);

create policy "Users can delete own photos"
  on photos for delete using (auth.uid() = user_id);

-- 2. Storage bucket (public so <img> tags can load photos directly)
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload only into their own user_id folder
create policy "Authenticated users can upload own photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone with the URL can view (needed for <img src> in the app and PDFs)
create policy "Public read access for job photos"
  on storage.objects for select
  using (bucket_id = 'job-photos');

-- Users can only delete files inside their own folder
create policy "Users can delete own photos from storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'job-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

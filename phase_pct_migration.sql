-- FieldQuote — Editable Phase Percentages Migration
-- Run in the Supabase SQL editor

alter table documents add column if not exists underground_pct int;
alter table documents add column if not exists rough_pct int;
alter table documents add column if not exists trim_pct int;

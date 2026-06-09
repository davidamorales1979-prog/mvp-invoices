-- FieldQuote — Scheduling Feature Migration
-- Run in the Supabase SQL editor

alter table documents add column if not exists scheduled_date date;

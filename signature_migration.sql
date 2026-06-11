-- FieldQuote — Digital Signature columns
-- Run in the Supabase SQL editor

alter table documents add column if not exists signature_token text unique;
alter table documents add column if not exists signature_data  text;        -- base64 PNG data URL
alter table documents add column if not exists signed_at       timestamptz;
alter table documents add column if not exists signer_name     text;

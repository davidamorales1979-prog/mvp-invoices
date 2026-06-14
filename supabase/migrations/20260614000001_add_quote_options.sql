alter table documents
  add column if not exists quote_options jsonb,
  add column if not exists selected_option_idx integer,
  add column if not exists options_token text unique;

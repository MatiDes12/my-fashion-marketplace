-- Create table to log sent newsletters/bulk emails
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text not null,
  subscription_type text check (subscription_type in ('notify_me','newsletter')),
  single_email text,
  recipients_count integer not null,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Optional: leave RLS disabled so admin UI (client) can read without special policies
alter table public.email_campaigns disable row level security;


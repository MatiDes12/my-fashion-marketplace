create table public.client_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  level text not null default 'info',
  message text not null,
  data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint client_logs_pkey primary key (id)
);

alter table public.client_logs enable row level security;

create policy "Users can insert their own client logs" on public.client_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own client logs" on public.client_logs
  for select
  using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant all on public.client_logs to authenticated;

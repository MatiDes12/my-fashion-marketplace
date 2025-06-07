-- Enable RLS
alter table public.payment_settings enable row level security;

-- Create policies
create policy "Users can view their own payment settings"
  on public.payment_settings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own payment settings"
  on public.payment_settings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own payment settings"
  on public.payment_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own payment settings"
  on public.payment_settings
  for delete
  using (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
grant usage on schema public to authenticated;
grant all on public.payment_settings to authenticated; 
create table public.payment_settings (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  telebirr_settings jsonb null default '{"is_active": false}'::jsonb,
  bank_settings jsonb null default '{"is_active": false}'::jsonb,
  cbe_birr_settings jsonb null default '{"is_active": false}'::jsonb,
  amole_settings jsonb null default '{"is_active": false}'::jsonb,
  chapa_settings jsonb null default '{"is_active": false}'::jsonb,
  mpesa_settings jsonb null default '{"is_active": false}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_settings_pkey primary key (id),
  constraint unique_user_settings unique (user_id),
  constraint payment_settings_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint valid_telebirr_settings check (
    (
      (not ((telebirr_settings ->> 'is_active'::text))::boolean) or
      (
        (telebirr_settings ? 'account_number'::text) and
        (telebirr_settings ? 'phone_number'::text)
      )
    )
  ),
  constraint valid_bank_settings check (
    (
      (not ((bank_settings ->> 'is_active'::text))::boolean) or
      (
        (bank_settings ? 'account_number'::text) and
        (bank_settings ? 'phone_number'::text) and
        (bank_settings ? 'bank_name'::text)
      )
    )
  ),
  constraint valid_cbe_birr_settings check (
    (
      (not ((cbe_birr_settings ->> 'is_active'::text))::boolean) or
      (
        (cbe_birr_settings ? 'account_number'::text) and
        (cbe_birr_settings ? 'phone_number'::text)
      )
    )
  ),
  constraint valid_amole_settings check (
    (
      (not ((amole_settings ->> 'is_active'::text))::boolean) or
      (
        (amole_settings ? 'account_number'::text) and
        (amole_settings ? 'phone_number'::text)
      )
    )
  ),
  constraint valid_chapa_settings check (
    (
      (not ((chapa_settings ->> 'is_active'::text))::boolean) or
      (
        (chapa_settings ? 'account_number'::text) and
        (chapa_settings ? 'phone_number'::text)
      )
    )
  ),
  constraint valid_mpesa_settings check (
    (
      (not ((mpesa_settings ->> 'is_active'::text))::boolean) or
      (
        (mpesa_settings ? 'account_number'::text) and
        (mpesa_settings ? 'phone_number'::text)
      )
    )
  )
); 
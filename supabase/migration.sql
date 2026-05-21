-- =====================================================================
-- Migration: features (edit/delete, reply, attachments, reactions)
-- Run in the Supabase SQL editor on your existing project. Idempotent —
-- safe to run multiple times.
-- =====================================================================

alter table public.messages
    add column if not exists edited_at       timestamptz,
    add column if not exists deleted_at      timestamptz,
    add column if not exists reply_to_id     uuid references public.messages(id) on delete set null,
    add column if not exists attachment_url  text,
    add column if not exists attachment_type text,
    add column if not exists attachment_name text;

alter table public.users
    add column if not exists birth_date    date,
    add column if not exists mobile_number text,
    add column if not exists avatar_url    text,
    add column if not exists caption       text;

-- Mobile numbers must be unique across users (when set).
-- Partial index so existing NULLs don't conflict.
create unique index if not exists users_mobile_number_unique
    on public.users (mobile_number)
    where mobile_number is not null;

-- Favorites — per-user starring of a conversation.
create table if not exists public.favorites (
    user_id         uuid not null references public.users(id) on delete cascade,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    created_at      timestamptz not null default now(),
    primary key (user_id, conversation_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

create table if not exists public.reactions (
    id          uuid primary key default gen_random_uuid(),
    message_id  uuid not null references public.messages(id) on delete cascade,
    user_id     uuid not null references public.users(id) on delete cascade,
    emoji       text not null,
    created_at  timestamptz not null default now(),
    constraint reactions_unique unique (message_id, user_id, emoji)
);

create index if not exists reactions_message_idx on public.reactions (message_id);

-- =====================================================================
-- OTP codes — short-lived single-use codes for email-based 2FA on
-- register and login. Code itself is bcrypt-hashed so a DB leak can't
-- be replayed. `payload` stashes pending registration data between
-- the request and verify steps (so the user doesn't have to re-type
-- everything to confirm).
-- =====================================================================
create table if not exists public.otp_codes (
    id          uuid primary key default gen_random_uuid(),
    email       text not null,
    purpose     text not null,
    code_hash   text not null,
    payload     jsonb,
    expires_at  timestamptz not null,
    attempts    int not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists otp_codes_email_purpose_idx
    on public.otp_codes (email, purpose, created_at desc);

-- =====================================================================
-- Storage bucket for image / file attachments (used by feature #8).
-- The 'attachments' bucket is created PUBLIC so attachment_url can be
-- read directly. Uploads go through the backend with the service role
-- key, so no client-side write access is needed.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

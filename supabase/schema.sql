-- =====================================================================
-- Real-Time 1:1 Chat App - Supabase / Postgres schema
-- Run this in the Supabase SQL editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
create table if not exists public.users (
    id            uuid primary key default gen_random_uuid(),
    username      text        not null unique,
    email         text        not null unique,
    password      text        not null,
    birth_date    date,
    mobile_number text,
    avatar_url    text,
    caption       text,
    created_at    timestamptz not null default now()
);

create index if not exists users_email_idx    on public.users (email);
create index if not exists users_username_idx on public.users (username);
create unique index if not exists users_mobile_number_unique
    on public.users (mobile_number)
    where mobile_number is not null;

-- ---------------------------------------------------------------------
-- CONVERSATIONS  (1:1)
-- Stored as a normalized pair (least_id, greatest_id) so the unique
-- index prevents duplicate conversations regardless of who started it.
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
    id         uuid primary key default gen_random_uuid(),
    user1_id   uuid not null references public.users(id) on delete cascade,
    user2_id   uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint conversations_distinct_users check (user1_id <> user2_id),
    constraint conversations_ordered check (user1_id < user2_id)
);

create unique index if not exists conversations_pair_uidx
    on public.conversations (user1_id, user2_id);

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id       uuid not null references public.users(id) on delete cascade,
    message         text not null,
    is_read         boolean not null default false,
    created_at      timestamptz not null default now(),
    edited_at       timestamptz,
    deleted_at      timestamptz,
    reply_to_id     uuid references public.messages(id) on delete set null,
    attachment_url  text,
    attachment_type text,
    attachment_name text
);

create index if not exists messages_conversation_idx
    on public.messages (conversation_id, created_at desc);

create index if not exists messages_unread_idx
    on public.messages (conversation_id, sender_id, is_read);

-- ---------------------------------------------------------------------
-- OTP CODES (email 2FA for register/login)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- FAVORITES (per-user starring of a conversation)
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
    user_id         uuid not null references public.users(id) on delete cascade,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    created_at      timestamptz not null default now(),
    primary key (user_id, conversation_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------
-- REACTIONS  (one row per user+message+emoji)
-- ---------------------------------------------------------------------
create table if not exists public.reactions (
    id          uuid primary key default gen_random_uuid(),
    message_id  uuid not null references public.messages(id) on delete cascade,
    user_id     uuid not null references public.users(id) on delete cascade,
    emoji       text not null,
    created_at  timestamptz not null default now(),
    constraint reactions_unique unique (message_id, user_id, emoji)
);

create index if not exists reactions_message_idx on public.reactions (message_id);

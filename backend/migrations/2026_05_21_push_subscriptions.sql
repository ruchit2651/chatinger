-- Web Push subscriptions. One row per (user, browser/device endpoint).
-- Run this once in the Supabase SQL Editor.

create table if not exists public.push_subscriptions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    endpoint    text not null,
    p256dh      text not null,
    auth        text not null,
    created_at  timestamptz not null default now(),
    unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
    on public.push_subscriptions (user_id);

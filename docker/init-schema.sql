-- Schema for the Agent OS store. Mirrors createStore().initSchema() in
-- src/lib/ghost.ts — keep the two in step when either changes.
-- Runs automatically on first `docker compose up` (empty volume only).

create table if not exists conversations (
  id text primary key,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id bigserial primary key,
  conversation_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists goals (
  id bigserial primary key,
  user_id bigint references users(id),
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  description text,
  deadline text,
  created_at timestamptz default now()
);

create table if not exists journal_entries (
  id bigserial primary key,
  conversation_id text,
  summary text not null,
  created_at timestamptz default now()
);

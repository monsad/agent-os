import { Pool } from "pg";
import { getEnv } from "./env";

export type QueryablePool = Pick<Pool, "query">;

export type JournalEntry = { id: number; conversation_id: string; summary: string; created_at: string };
export type Goal = { id: number; user_id: number; title: string; status: string; priority: string; created_at: string };
export type User = { id: number; username: string; password_hash: string; created_at: string };

export function createStore(pool: QueryablePool) {
  return {
    async initSchema(): Promise<void> {
      await pool.query(`create table if not exists conversations (
        id text primary key,
        title text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists messages (
        id bigserial primary key,
        conversation_id text not null,
        role text not null,
        content text not null,
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists users (
        id bigserial primary key,
        username text unique not null,
        password_hash text not null,
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists goals (
        id bigserial primary key,
        user_id bigint references users(id),
        title text not null,
        status text not null default 'open',
        priority text not null default 'medium',
        description text,
        deadline text,
        created_at timestamptz default now()
      )`);
      // Migrate pre-existing goals tables so per-user + priority columns exist.
      await pool.query(`alter table goals add column if not exists user_id bigint`);
      await pool.query(`alter table goals add column if not exists priority text not null default 'medium'`);
      await pool.query(`alter table goals add column if not exists description text`);
      await pool.query(`alter table goals add column if not exists deadline text`);
      await pool.query(`create table if not exists journal_entries (
        id bigserial primary key,
        conversation_id text,
        summary text not null,
        created_at timestamptz default now()
      )`);
    },

    async createUser(username: string, passwordHash: string): Promise<User> {
      const { rows } = await pool.query(
        `insert into users (username, password_hash) values ($1, $2)
         returning id, username, password_hash, created_at`,
        [username, passwordHash],
      );
      return rows[0] as User;
    },

    async getUserByUsername(username: string): Promise<User | null> {
      const { rows } = await pool.query(
        `select id, username, password_hash, created_at from users where username = $1`,
        [username],
      );
      return (rows[0] as User) ?? null;
    },

    async countUsers(): Promise<number> {
      const { rows } = await pool.query(`select count(*)::int as n from users`);
      return (rows[0] as { n: number }).n;
    },

    async insertMessage(conversationId: string, role: string, content: string): Promise<void> {
      await pool.query(
        `insert into conversations (id) values ($1) on conflict (id) do nothing`,
        [conversationId],
      );
      await pool.query(
        `insert into messages (conversation_id, role, content) values ($1, $2, $3)`,
        [conversationId, role, content],
      );
    },

    async recentJournal(limit = 20): Promise<JournalEntry[]> {
      const { rows } = await pool.query(
        `select id, conversation_id, summary, created_at
         from journal_entries order by created_at desc limit $1`,
        [limit],
      );
      return rows as JournalEntry[];
    },

    async listGoals(userId: number): Promise<Goal[]> {
      const { rows } = await pool.query(
        `select id, user_id, title, status, priority, created_at from goals
         where user_id = $1 order by created_at desc`,
        [userId],
      );
      return rows as Goal[];
    },

    async addGoal(
      userId: number,
      fields: { title: string; priority: string; description?: string | null; deadline?: string | null },
    ): Promise<Goal> {
      const { rows } = await pool.query(
        `insert into goals (user_id, title, priority, description, deadline)
         values ($1, $2, $3, $4, $5)
         returning id, user_id, title, status, priority, created_at`,
        [userId, fields.title, fields.priority, fields.description ?? null, fields.deadline ?? null],
      );
      return rows[0] as Goal;
    },

    async updateGoal(
      userId: number,
      id: number,
      fields: { title?: string; status?: string; priority?: string },
    ): Promise<Goal | null> {
      const { rows } = await pool.query(
        `update goals set
           title = coalesce($3, title),
           status = coalesce($4, status),
           priority = coalesce($5, priority)
         where id = $1 and user_id = $2
         returning id, user_id, title, status, priority, created_at`,
        [id, userId, fields.title ?? null, fields.status ?? null, fields.priority ?? null],
      );
      return (rows[0] as Goal) ?? null;
    },

    async deleteGoal(userId: number, id: number): Promise<boolean> {
      const { rowCount } = await pool.query(`delete from goals where id = $1 and user_id = $2`, [id, userId]);
      return (rowCount ?? 0) > 0;
    },

    async searchMessages(term: string, limit = 20): Promise<{ conversation_id: string; content: string }[]> {
      const { rows } = await pool.query(
        `select conversation_id, content from messages
         where content ilike $1 order by created_at desc limit $2`,
        [`%${term}%`, limit],
      );
      return rows as { conversation_id: string; content: string }[];
    },

    async isAvailable(): Promise<boolean> {
      try {
        await pool.query("select 1");
        return true;
      } catch {
        return false;
      }
    },
  };
}

let singleton: ReturnType<typeof createStore> | null = null;

export function getStore(): ReturnType<typeof createStore> {
  if (singleton) return singleton;
  const pool = new Pool({ connectionString: getEnv("GHOST_DATABASE_URL") });
  singleton = createStore(pool);
  return singleton;
}

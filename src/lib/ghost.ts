import { Pool } from "pg";
import { getEnv } from "./env";

export type QueryablePool = Pick<Pool, "query">;

export type JournalEntry = { id: number; conversation_id: string; summary: string; created_at: string };
export type Goal = { id: number; title: string; status: string; created_at: string };

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
      await pool.query(`create table if not exists goals (
        id bigserial primary key,
        title text not null,
        status text not null default 'open',
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists journal_entries (
        id bigserial primary key,
        conversation_id text,
        summary text not null,
        created_at timestamptz default now()
      )`);
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

    async listGoals(): Promise<Goal[]> {
      const { rows } = await pool.query(
        `select id, title, status, created_at from goals order by created_at desc`,
      );
      return rows as Goal[];
    },

    async addGoal(title: string): Promise<Goal> {
      const { rows } = await pool.query(
        `insert into goals (title) values ($1)
         returning id, title, status, created_at`,
        [title],
      );
      return rows[0] as Goal;
    },

    async updateGoal(id: number, fields: { title?: string; status?: string }): Promise<Goal | null> {
      const { rows } = await pool.query(
        `update goals set
           title = coalesce($2, title),
           status = coalesce($3, status)
         where id = $1
         returning id, title, status, created_at`,
        [id, fields.title ?? null, fields.status ?? null],
      );
      return (rows[0] as Goal) ?? null;
    },

    async deleteGoal(id: number): Promise<boolean> {
      const { rowCount } = await pool.query(`delete from goals where id = $1`, [id]);
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

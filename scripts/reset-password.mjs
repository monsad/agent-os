#!/usr/bin/env node
// Reset a local operator's password.
//
// Agent OS has no password-recovery flow by design: it is a single-operator tool
// on localhost, so there is no second channel (email, SMS) to prove identity
// through. Whoever can run this script already has the machine and the database,
// which is the same level of access a recovery flow would have to trust anyway.
//
// The password is read from a hidden prompt rather than argv so it never reaches
// the process list or the shell history.

import { createInterface } from "node:readline";
import { scryptSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
      }
    } catch {
      /* file is optional */
    }
  }
}

/**
 * Ask for two secrets without echoing them.
 *
 * A terminal and a pipe need genuinely different handling, so this branches
 * once rather than trying to make one readline serve both. On a pipe, readline
 * hits EOF after the first line and a second `question` never resolves — so
 * piped input is read whole and split instead. The pipe path exists so this is
 * testable; interactively, only the terminal path runs.
 */
async function askTwice(first, second) {
  if (!process.stdin.isTTY) {
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;
    const [a = "", b = ""] = raw.split("\n");
    return [a, b];
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = (question) =>
    new Promise((resolve) => {
      // Swallow the echo so the password never appears on screen.
      const write = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (s) => write(s.startsWith(question) ? question : "");
      rl.question(question, (answer) => {
        process.stdout.write("\n");
        resolve(answer);
      });
    });
  const a = await ask(first);
  const b = await ask(second);
  rl.close();
  return [a, b];
}

const username = process.argv[2];
if (!username) {
  console.error("usage: node scripts/reset-password.mjs <username>");
  process.exit(1);
}

loadEnv();
const connectionString = process.env.GHOST_DATABASE_URL;
if (!connectionString) {
  console.error("GHOST_DATABASE_URL is not set — cannot reach the database.");
  process.exit(1);
}

const [password, again] = await askTwice(`New password for "${username}": `, "Repeat it: ");
if (password !== again) {
  console.error("The two entries differ — nothing was changed.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use at least 8 characters — nothing was changed.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const stored = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const pool = new pg.Pool({ connectionString });
try {
  const { rowCount } = await pool.query("update users set password_hash = $1 where username = $2", [
    stored,
    username,
  ]);
  if (rowCount === 0) {
    console.error(`No user named "${username}".`);
    process.exit(1);
  }
  console.log(`Password updated for "${username}". Existing sessions stay valid.`);
} finally {
  await pool.end();
}

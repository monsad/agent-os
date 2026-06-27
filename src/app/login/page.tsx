"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (r.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect passcode.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-teal-500/20 bg-white/5 p-8 shadow-xl backdrop-blur-md"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold text-teal-300">Agent OS</h1>
          <p className="text-xs text-neutral-400">Mission Control · enter passcode</p>
        </div>
        <input
          type="password"
          aria-label="Passcode"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-teal-400/60"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-teal-500/80 py-2 text-sm font-medium text-neutral-950 hover:bg-teal-400 disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

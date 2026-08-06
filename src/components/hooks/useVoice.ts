"use client";
import { useCallback, useRef, useState } from "react";

// Local voice loop: mic → /api/voice/transcribe (whisper) → text, and
// text → /api/voice/speak (piper) → spoken audio. No cloud, no keys.
export type VoiceState = "idle" | "recording" | "transcribing";

export function useVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [speaking, setSpeaking] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    setState("recording");
  }, []);

  // Stop the mic, ship the clip to whisper, return the transcript ("" on failure).
  const stopRecording = useCallback(async (): Promise<string> => {
    const rec = recorderRef.current;
    if (!rec) return "";
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
    });
    rec.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;

    const blob = await done;
    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = await res.json();
      return res.ok ? String(data.text ?? "").trim() : "";
    } catch {
      return "";
    } finally {
      setState("idle");
    }
  }, []);

  // Speak assistant text through piper. Resolves when playback finishes.
  const speak = useCallback(async (text: string): Promise<void> => {
    const clean = text.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
      URL.revokeObjectURL(url);
    } catch {
      /* non-fatal — voice is an enhancement, text still works */
    } finally {
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  return { state, speaking, startRecording, stopRecording, speak, stopSpeaking };
}

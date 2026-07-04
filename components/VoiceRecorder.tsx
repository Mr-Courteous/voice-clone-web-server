"use client";

import { useRef, useState, useEffect } from "react";

type Voice = {
  id: string;
  name: string;
  elevenVoiceId: string;
  status: string;
};

// Swap this for real auth (NextAuth, Clerk, etc). Kept simple for MVP.
const DEMO_USER_ID = "demo-user-id";

const BAR_COUNT = 24;

export default function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [text, setText] = useState("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const active = recording || uploading || synthesizing;

  useEffect(() => {
    async function loadVoices() {
      try {
        const res = await fetch("/api/voices");
        if (res.ok) {
          const data = await res.json();
          setVoices(data.voices || data || []);
        }
      } catch (e) {
        console.error("Failed to load voices:", e);
      }
    }
    loadVoices();
  }, []);

  async function startRecording() {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadSample(blob, "sample.webm");
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setError("Choose an audio or video file — wav, mp3, m4a, mp4, mov, webm.");
      e.target.value = "";
      return;
    }

    uploadSample(file, file.name);
    e.target.value = "";
  }

  async function uploadSample(blob: Blob, filename: string) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, filename);
      formData.append("userId", DEMO_USER_ID);
      formData.append("voiceName", `Voice ${new Date().toLocaleString()}`);

      const res = await fetch("/api/clone-voice", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clone failed");

      if (data.voice) {
        setVoices((prev) => [data.voice, ...prev]);
        setSelectedVoice(data.voice.id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSynthesize() {
    if (!selectedVoice || !text.trim()) return;
    setSynthesizing(true);
    setError(null);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: selectedVoice, text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Synthesis failed");
      }

      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSynthesizing(false);
    }
  }

  const sampleReady = voices.length > 0;
  const voiceReady = !!selectedVoice;
  const scriptReady = !!text.trim();
  const outputReady = !!audioUrl;

  return (
    <div className="rack">
      <header className="rack-header">
        <div className="brand">
          <span className="brand-led" data-on={sampleReady} />
          <span className="brand-name">VOICE&nbsp;CLONE&nbsp;CONSOLE</span>
        </div>
        <span className="brand-sub">XTTS-v2 · zero-shot synthesis</span>
      </header>

      {/* Signature VU meter — reflects overall console activity */}
      <div className="meter" aria-hidden="true">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className="meter-bar"
            data-active={active}
            data-ready={outputReady && !active}
            style={{ animationDelay: `${(i % 8) * 70}ms` }}
          />
        ))}
      </div>

      <div className="console">
        {/* Channel 01 — Input */}
        <section className="channel">
          <div className="channel-label">
            <span className="led" data-on={sampleReady} />
            <span className="eyebrow">CH.01 — INPUT</span>
          </div>
          <p className="channel-hint">Record or upload a sample. Aim for 60s+ of clean speech.</p>

          <div className="input-row">
            {!recording ? (
              <button className="btn btn-primary" onClick={startRecording} disabled={uploading}>
                <span className="dot" /> Start Recording
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopRecording}>
                <span className="dot" /> Stop &amp; Clone
              </button>
            )}

            <span className="or">or</span>

            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || recording}
            >
              Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="sr-only"
              onChange={handleFileSelect}
            />
          </div>

          {uploading && <p className="status-line">Cloning voice — sending sample to the engine…</p>}
        </section>

        <div className="rule" />

        {/* Channel 02 — Voice */}
        <section className="channel">
          <div className="channel-label">
            <span className="led" data-on={voiceReady} />
            <span className="eyebrow">CH.02 — VOICE</span>
          </div>
          <select
            className="select"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            <option value="">Select a cloned voice…</option>
            {voices.map(
              (v) =>
                v && (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                )
            )}
          </select>
        </section>

        <div className="rule" />

        {/* Channel 03 — Script */}
        <section className="channel">
          <div className="channel-label">
            <span className="led" data-on={scriptReady} />
            <span className="eyebrow">CH.03 — SCRIPT</span>
          </div>
          <textarea
            rows={4}
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type what the cloned voice should say…"
          />
          <button
            className="btn btn-primary btn-block"
            onClick={handleSynthesize}
            disabled={!selectedVoice || !text.trim() || synthesizing}
          >
            {synthesizing ? "Generating…" : "Speak It"}
          </button>
        </section>

        {/* Channel 04 — Output */}
        {audioUrl && (
          <>
            <div className="rule" />
            <section className="channel">
              <div className="channel-label">
                <span className="led" data-on="true" data-success="true" />
                <span className="eyebrow">CH.04 — OUTPUT</span>
              </div>
              <audio controls src={audioUrl} key={audioUrl} className="player" />
            </section>
          </>
        )}

        {error && (
          <div className="alert">
            <span className="led" data-on="true" data-error="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .rack {
          --bg: #0f1215;
          --panel: #15191d;
          --panel-raised: #1b2025;
          --border: #262b30;
          --amber: #f5a623;
          --green: #3ddc84;
          --red: #e5484d;
          --text-hi: #eceef0;
          --text-mid: #b3b9bf;
          --text-muted: #767d84;
          --mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
          --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;

          max-width: 640px;
          margin: 0 auto;
          padding: 20px 16px 48px;
          font-family: var(--sans);
          color: var(--text-hi);
        }

        .rack-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 18px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-led {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        .brand-led[data-on="true"] {
          background: var(--green);
          box-shadow: 0 0 8px 1px rgba(61, 220, 132, 0.6);
        }

        .brand-name {
          font-family: var(--mono);
          font-size: 14px;
          letter-spacing: 0.08em;
          font-weight: 600;
          color: var(--text-hi);
        }

        .brand-sub {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.03em;
        }

        /* Signature VU meter */
        .meter {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 40px;
          padding: 10px 12px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px 8px 0 0;
          border-bottom: none;
          overflow: hidden;
        }
        .meter-bar {
          flex: 1;
          min-width: 2px;
          height: 18%;
          border-radius: 1px;
          background: var(--border);
          transition: background 0.25s ease;
        }
        .meter-bar[data-active="true"] {
          background: var(--amber);
          animation: bounce 0.9s ease-in-out infinite;
        }
        .meter-bar[data-ready="true"] {
          background: var(--green);
          height: 55%;
        }
        @keyframes bounce {
          0%, 100% { height: 15%; }
          50% { height: 85%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .meter-bar[data-active="true"] {
            animation: none;
            height: 60%;
          }
        }

        .console {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 0 0 8px 8px;
          padding: 4px 20px 20px;
        }

        .channel {
          padding: 18px 0 6px;
        }

        .channel-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .led {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #3a4147;
          flex-shrink: 0;
        }
        .led[data-on="true"] {
          background: var(--amber);
          box-shadow: 0 0 6px 1px rgba(245, 166, 35, 0.55);
        }
        .led[data-success="true"] {
          background: var(--green);
          box-shadow: 0 0 6px 1px rgba(61, 220, 132, 0.55);
        }
        .led[data-error="true"] {
          background: var(--red);
          box-shadow: 0 0 6px 1px rgba(229, 72, 77, 0.55);
        }

        .channel-hint {
          margin: 0 0 12px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .rule {
          height: 1px;
          background: var(--border);
          margin: 0;
        }

        .input-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .or {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .btn {
          font-family: var(--sans);
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 16px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--panel-raised);
          color: var(--text-hi);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.15s ease, transform 0.05s ease, filter 0.15s ease;
        }
        .btn:hover:not(:disabled) {
          border-color: var(--amber);
        }
        .btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .btn:focus-visible {
          outline: 2px solid var(--amber);
          outline-offset: 2px;
        }
        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--amber);
          border-color: var(--amber);
          color: #191300;
        }
        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.08);
        }
        .btn-primary .dot {
          background: #191300;
        }

        .btn-danger {
          background: var(--red);
          border-color: var(--red);
          color: #1a0000;
        }
        .btn-danger .dot {
          background: #1a0000;
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .btn-secondary {
          background: transparent;
        }

        .btn-block {
          width: 100%;
          justify-content: center;
          margin-top: 10px;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .status-line {
          margin: 10px 0 0;
          font-family: var(--mono);
          font-size: 12px;
          color: var(--amber);
        }

        .select,
        .textarea {
          width: 100%;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          color: var(--text-hi);
          border-radius: 6px;
          padding: 10px 12px;
          font-family: var(--sans);
          font-size: 14px;
          resize: vertical;
        }
        .select:focus-visible,
        .textarea:focus-visible {
          outline: 2px solid var(--amber);
          outline-offset: 1px;
        }
        .textarea {
          margin-bottom: 4px;
        }
        .textarea::placeholder {
          color: var(--text-muted);
        }

        .player {
          width: 100%;
          height: 36px;
          filter: invert(0.88) hue-rotate(180deg);
        }

        .alert {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(229, 72, 77, 0.08);
          border: 1px solid rgba(229, 72, 77, 0.35);
          color: #ff9a9d;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 13px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        @media (max-width: 420px) {
          .rack { padding: 14px 10px 36px; }
          .console { padding: 4px 14px 16px; }
          .brand-sub { display: none; }
        }
      `}</style>
    </div>
  );
}
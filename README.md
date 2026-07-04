# Voice Clone Studio (Next.js Full Stack)

One Next.js app, one deploy. Record your voice in the browser, clone it, then
type any text and hear it spoken back in your own voice.

## Stack
- **Frontend + Backend**: Next.js 14 App Router (route handlers = your API)
- **Voice AI**: ElevenLabs (cloning + TTS)
- **Database**: Postgres via Prisma (swap in Vercel Postgres, Supabase, or Neon)
- **Storage**: Vercel Blob (raw samples + generated mp3s)

## Setup

```bash
npm install
cp .env.example .env       # fill in your keys
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000, click **Start Recording**, speak for 60+ seconds,
stop, wait for cloning, pick your voice, type text, hit **Speak It**.

## Getting the keys
1. **ElevenLabs**: sign up, free tier only lets you use stock voices — you need
   the **Starter plan ($5/mo)** or above to unlock custom voice cloning
   (`voices/add` endpoint).
2. **Vercel Postgres / Neon / Supabase**: any gives you a `DATABASE_URL`.
3. **Vercel Blob**: enable it in your Vercel project settings, it injects
   `BLOB_READ_WRITE_TOKEN` automatically on deploy.

## Deploying
Push to GitHub, import into Vercel, add the three env vars in Project
Settings, deploy. That's the one deploy you asked for — frontend, API
routes, and DB access all ship together.

## On accuracy — set expectations correctly
- A single 60–90s sample (what this MVP records) gets you ElevenLabs'
  **Instant Voice Cloning**: roughly 85–90% perceptual similarity. Good
  enough for personal apps, assistants, notifications.
- For near-indistinguishable results (~98%), you need ElevenLabs
  **Professional Voice Cloning**, which requires 30+ minutes of clean,
  varied studio-quality audio and is processed asynchronously (hours,
  not seconds). If you want that tier, the next build step is a
  multi-clip upload flow instead of a single 60s recording.
- No provider — ElevenLabs included — advertises or achieves literal
  100% identity. Treat any claim of that as marketing, not spec.

## Production hardening (not yet in this MVP)
- Replace `DEMO_USER_ID` with real auth (NextAuth/Clerk) — right now every
  visitor shares one user record.
- Add rate limiting on `/api/synthesize` (ElevenLabs bills per character).
- Add consent/verification step before cloning — most jurisdictions and
  ElevenLabs' own ToS require the speaker to consent to their own clone.
- Move long-running professional cloning into a background job/queue
  rather than a synchronous request.

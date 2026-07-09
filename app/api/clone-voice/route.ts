// app/api/clone-voice/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Your Hugging Face Space running app.py (XTTS-v2 server)
const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://mr-courteous-voice-clone.hf.space';

export const runtime = 'nodejs';
// Free/cold HF Spaces can take a while to wake up + load the model.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = (formData.get('file') || formData.get('audio') || formData.get('blob')) as File;
    const name = (formData.get('name') || formData.get('voiceName') || formData.get('voice_name')) as string;

    if (!file) return NextResponse.json({ error: 'Audio file missing.' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Voice name missing.' }, { status: 400 });

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({ data: { email: 'developer@example.com' } });
    }

    // Read the upload once into memory — no filesystem writes anywhere
    // (serverless deploy targets like Vercel ship a read-only filesystem
    // outside of /tmp, so writing to public/uploads throws EROFS).
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'audio/wav';

    // Store the sample directly in the database as a data URL, so playback
    // works without needing any file storage at all.
    const sampleDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // --- Forward the sample to the XTTS-v2 engine on Hugging Face, from memory ---
    const engineForm = new FormData();
    // app.py expects the field name "file"
    engineForm.append('file', new Blob([buffer], { type: mimeType }), file.name || 'voice.wav');

    const engineRes = await fetch(`${HF_SPACE_URL}/api/clone`, {
      method: 'POST',
      body: engineForm,
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Voice engine error (${engineRes.status}): ${errText || 'clone failed'}` },
        { status: 502 }
      );
    }

    const engineData = await engineRes.json();
    const speakerId = engineData.speaker_id;

    if (!speakerId) {
      return NextResponse.json({ error: 'Voice engine did not return a speaker_id.' }, { status: 502 });
    }

    // Persist: sampleUrl now holds a data URL (DB-only, no disk); elevenVoiceId
    // stores the real XTTS speaker_id the engine uses for synthesis.
    const newVoice = await db.voice.create({
      data: {
        userId: user.id,
        name: name,
        sampleUrl: sampleDataUrl,
        elevenVoiceId: speakerId,
        status: 'ready',
      },
    });

    // The engine flags clips that are too short to clone accurately —
    // surface that to the frontend instead of letting it fail silently.
    return NextResponse.json({
      success: true,
      voice: newVoice,
      warning: engineData.warning || null,
    });
  } catch (error: any) {
    console.error('Cloning error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
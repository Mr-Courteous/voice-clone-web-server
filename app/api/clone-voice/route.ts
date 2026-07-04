// app/api/clone-voice/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

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

    // Save a local copy so the frontend can always play back the original sample
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${file.name || 'voice.webm'}`;
    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    const relativeUrl = `/uploads/${filename}`;

    // --- Forward the sample to the XTTS-v2 engine on Hugging Face ---
    const engineForm = new FormData();
    // app.py expects the field name "file"
    engineForm.append('file', new Blob([buffer], { type: file.type || 'audio/wav' }), file.name || 'voice.wav');

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

    // Persist: elevenVoiceId now stores the *real* XTTS speaker_id used for synthesis
    const newVoice = await db.voice.create({
      data: {
        userId: user.id,
        name: name,
        sampleUrl: relativeUrl,
        elevenVoiceId: speakerId,
        status: 'ready',
      },
    });

    return NextResponse.json({ success: true, voice: newVoice });
  } catch (error: any) {
    console.error('Cloning error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
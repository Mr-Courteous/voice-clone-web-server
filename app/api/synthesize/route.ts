// app/api/synthesize/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://mr-courteous-voice-clone.hf.space';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
    try {
        const { text, voiceId, language } = await request.json();

        if (!text || !text.trim()) {
            return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
        }

        // 1. Fetch voice metadata from your database
        let voice = await db.voice.findUnique({ where: { id: voiceId } });
        if (!voice) {
            voice = await db.voice.findFirst({ orderBy: { createdAt: 'desc' } });
        }

        if (!voice || !voice.elevenVoiceId) {
            return NextResponse.json({ error: 'Please record a voice sample first.' }, { status: 404 });
        }

        console.log(`Synthesizing text: "${text}" for voice: ${voice.name} (speaker_id=${voice.elevenVoiceId})`);

        // 2. Call the XTTS-v2 engine on Hugging Face for real zero-shot synthesis
        const engineForm = new FormData();
        engineForm.append('speaker_id', voice.elevenVoiceId);
        engineForm.append('text', text);
        engineForm.append('language', language || 'en');

        const engineRes = await fetch(`${HF_SPACE_URL}/api/tts`, {
            method: 'POST',
            body: engineForm,
        });

        if (!engineRes.ok) {
            const errText = await engineRes.text().catch(() => '');
            return NextResponse.json(
                { error: `Voice engine error (${engineRes.status}): ${errText || 'synthesis failed'}` },
                { status: 502 }
            );
        }

        // 3. Hold the generated audio in memory only — no filesystem writes.
        // Encode as a data URL so the DB stores the audio and the frontend can
        // play it back directly with zero file storage involved.
        const audioArrayBuffer = await engineRes.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        const audioDataUrl = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;

        console.log(`Success! Generated ${audioBuffer.length} bytes of audio for voice ${voice.name}`);

        // 4. Save the generation to your Prisma history database (audio + text)
        await db.generation.create({
            data: {
                voiceId: voice.id,
                text: text,
                audioUrl: audioDataUrl,
            }
        });

        return NextResponse.json({
            audioUrl: audioDataUrl,
            success: true
        });

    } catch (error: any) {
        console.error('Synthesis route error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
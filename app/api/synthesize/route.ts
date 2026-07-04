// app/api/synthesize/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

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

        const audioArrayBuffer = await engineRes.arrayBuffer();

        // 3. Save the returned wav to disk so the frontend can play/reference it via a URL
        const outputDir = path.join(process.cwd(), 'public', 'generated');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFilename = `cloned-output-${Date.now()}.wav`;
        const absoluteOutputPath = path.join(outputDir, outputFilename);
        fs.writeFileSync(absoluteOutputPath, Buffer.from(audioArrayBuffer));
        const generatedAudioUrl = `/generated/${outputFilename}`;

        console.log(`Success! Created new cloned output at: ${generatedAudioUrl}`);

        // 4. Save the new output file tracking details to your Prisma history database
        await db.generation.create({
            data: {
                voiceId: voice.id,
                text: text,
                audioUrl: generatedAudioUrl,
            }
        });

        return NextResponse.json({
            audioUrl: generatedAudioUrl,
            success: true
        });

    } catch (error: any) {
        console.error('Synthesis route error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
// app/api/voices/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Fetch your registered XTTS voices from the database
    const voices = await db.voice.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Match the exact naming syntax the frontend useEffect expects (.voices)
    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error('Failed to retrieve voices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
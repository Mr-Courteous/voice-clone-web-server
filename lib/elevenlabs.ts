/**
 * All calls to ElevenLabs happen ONLY here, on the server.
 * The API key never reaches the browser.
 */

const BASE_URL = "https://api.elevenlabs.io/v1";

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

/**
 * Instant Voice Cloning: send one audio sample, get back a voice_id.
 * For "professional" quality, send multiple longer samples (see docs) —
 * same endpoint, just pass more files in the FormData.
 */
export async function cloneVoice(params: {
  name: string;
  files: { blob: Blob; filename: string }[];
  description?: string;
}) {
  const form = new FormData();
  form.append("name", params.name);
  if (params.description) form.append("description", params.description);
  for (const f of params.files) {
    form.append("files", f.blob, f.filename);
  }

  const res = await fetch(`${BASE_URL}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs clone failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { voice_id: string };
  return data.voice_id;
}

/**
 * Text-to-Speech using a previously cloned voice_id.
 * Returns raw mp3 bytes as an ArrayBuffer.
 */
export async function synthesizeSpeech(params: {
  voiceId: string;
  text: string;
  modelId?: string; // "eleven_multilingual_v2" is the highest-fidelity model
  stability?: number; // 0-1, lower = more expressive, higher = more consistent
  similarityBoost?: number; // 0-1, how closely it hugs the cloned timbre
}) {
  const res = await fetch(`${BASE_URL}/text-to-speech/${params.voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: params.modelId ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarityBoost ?? 0.85,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs synth failed (${res.status}): ${errText}`);
  }

  return res.arrayBuffer();
}

export async function deleteVoice(voiceId: string) {
  await fetch(`${BASE_URL}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey() },
  });
}

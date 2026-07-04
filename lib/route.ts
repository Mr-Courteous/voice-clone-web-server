/**
 * All calls to the self-hosted XTTS-v2 engine happen HERE on the server.
 */

const BASE_URL = process.env.XTTS_SERVICE_URL || "http://localhost:8000";

/**
 * Sends a reference audio sample to the local XTTS engine.
 * Returns a local speaker_id file reference string.
 */
export async function cloneVoice(params: {
    name: string;
    files: { blob: Blob; filename: string }[];
    description?: string;
}) {
    const targetFile = params.files[0];
    if (!targetFile) throw new Error("No audio sample provided for voice cloning");

    const form = new FormData();
    // Pass the raw blob directly to the Python FastAPI backend
    form.append("file", targetFile.blob, targetFile.filename);

    const res = await fetch(`${BASE_URL}/api/clone`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`XTTS reference registration failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { speaker_id: string };

    // This string maps straight into your schema's 'elevenVoiceId' field seamlessly
    return data.speaker_id;
}

/**
 * Zero-shot Text-to-Speech using the saved speaker reference filename.
 * Returns raw WAV bytes as an ArrayBuffer.
 */
export async function synthesizeSpeech(params: {
    voiceId: string; // This will be your local speaker_id string now
    text: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
}) {
    const form = new FormData();
    form.append("speaker_id", params.voiceId);
    form.append("text", params.text);
    form.append("language", "en"); // Adjust default language selection if needed

    const res = await fetch(`${BASE_URL}/api/tts`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`XTTS synthesis inference failed (${res.status}): ${errText}`);
    }

    return res.arrayBuffer();
}

export async function deleteVoice(voiceId: string) {
    // Optional: Add a cleanup endpoint on your Python service if you wish to delete files physically
    console.log(`Requested deletion for speaker reference: ${voiceId}`);
}
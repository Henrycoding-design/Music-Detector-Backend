import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export interface MusicRecognitionResult {
    title: string;
    artist: string;
    album: string | null;
    genre: string | null;
    released: string | null;
    cover: string | null;
    coverHQ: string | null;
    shazamUrl: string;
    isrc: string | null;
}

// Parse multiple keys from environment variables. Fallback to a single key if necessary.
const apiKeys: string[] = process.env.RAPIDAPI_KEYS 
    ? process.env.RAPIDAPI_KEYS.split(",").map(k => k.trim())
    : [process.env.RAPIDAPI_KEY || ""];

// Track the current key index across invocations
let currentKeyIndex = 0;

export async function recognizeSong(
    filePath: string
): Promise<MusicRecognitionResult> {
    console.log(apiKeys);
    if (!apiKeys.length || !apiKeys[0]) {
        throw new Error("No RapidAPI keys provided in environment variables.");
    }

    const maxAttempts = Math.max(apiKeys.length * 2, 6);
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;

        // Recreate the form data and stream on every attempt, 
        // as a consumed stream cannot be reused in a retry.
        const form = new FormData();
        form.append("file", fs.createReadStream(filePath), {
            filename: "audio.mp3",
            contentType: "audio/mpeg",
        });

        const activeKey = apiKeys[currentKeyIndex];

        try {
            const { data } = await axios.post(
                "https://shazam-core.p.rapidapi.com/v1/tracks/recognize",
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        "X-RapidAPI-Key": activeKey,
                        "X-RapidAPI-Host": process.env.RAPIDAPI_HOST || "shazam-core.p.rapidapi.com",
                    },
                }
            );

            const songSection = data.track.sections?.find(
                (section: any) => section.type === "SONG"
            );

            const metadata = songSection?.metadata ?? [];

            return {
                title: data.track.title,
                artist: data.track.subtitle,
                album:
                    metadata.find((m: any) => m.title === "Album")?.text ?? null,
                genre: data.track.genres?.primary ?? null,
                released:
                    metadata.find((m: any) => m.title === "Released")?.text ?? null,
                cover: data.track.images?.coverart ?? null,
                coverHQ: data.track.images?.coverarthq ?? null,
                shazamUrl: data.track.url,
                isrc: data.track.isrc ?? null,
            };

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                console.warn(`[Attempt ${attempts}] Request failed with status: ${status}`);

                // 429 Too Many Requests -> Rotate to a different key and retry
                if (status === 429) {
                    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                    console.log(`Rate limit reached. Rotating to key index: ${currentKeyIndex}`);
                    continue;
                }

                // 503 Service Unavailable -> Retry using the exact same key
                if (status === 503) {
                    console.log("Service temporarily unavailable (503). Retrying with the same key...");
                    continue;
                }

                // Log details for any other unexpected Axios error
                console.dir(error.response?.data, { depth: null });
            }

            // Throw immediately for non-retryable errors (e.g., 400, 401, network issues)
            throw error;
        }
    }

    throw new Error(`Failed to recognize song after maximum retry attempts (${maxAttempts}).`);
}
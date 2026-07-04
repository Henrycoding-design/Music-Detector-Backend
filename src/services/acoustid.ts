import axios from "axios";

export interface AcoustIDRecording {
    id: string;
    title: string | null;
    artist: string | null;
    duration: number | null;
}

export interface AcoustIDResult {
    score: number;
    recording: AcoustIDRecording | null;
}

export async function identifyByAcoustID(
    fingerprint: string,
    duration: number
): Promise<AcoustIDResult> {

    try {

        const { data } = await axios.get(
            "https://api.acoustid.org/v2/lookup",
            {
                params: {
                    client: process.env.ACOUSTID_API_KEY,
                    duration,
                    fingerprint,
                    meta: "recordings",
                },
                timeout: 10000,
            }
        );

        if (
            data.status !== "ok" ||
            !Array.isArray(data.results) ||
            data.results.length === 0
        ) {
            throw new Error("No AcoustID matches found.");
        }

        const best = data.results[0];

        const recording = best.recordings?.[0];

        return {
            score: best.score,
            recording: recording
                ? {
                    id: recording.id,
                    title: recording.title ?? null,
                    artist: recording.artists?.[0]?.name ?? null,
                    duration: recording.duration ?? null,
                }
                : null,
        };

    } catch (error) {

        if (axios.isAxiosError(error)) {

            console.error("========== ACOUSTID ERROR ==========");
            console.error("Status:", error.response?.status);
            console.dir(error.response?.data, { depth: null });

        }

        throw error;
    }
}
import { fingerprintAudio } from "./chromaprint.js";
import { identifyByAcoustID } from "./acoustid.js";
import { lookupRecording } from "./musicbrainz.js";
import { recognizeSong } from "./shazam.js";
import type { MusicResult } from "../config.js";

export async function recognize(filePath: string): Promise<MusicResult[]> {
    let acoustIdResult: MusicResult | null = null;
    let duration: number | undefined;

    try {
        console.log(`[Recognition] Generating fingerprint for: ${filePath}`);
        const fp = await fingerprintAudio(filePath);
        duration = fp.duration;

        console.log(`[Recognition] Querying AcoustID with duration: ${duration}`);
        const acoustId = await identifyByAcoustID(fp.fingerprint, fp.duration);
        // console.dir(acoustId, { depth: null });

        if (acoustId && acoustId.recording) {
            console.log(`[Recognition] AcoustID match found (score: ${acoustId.score}). Querying MusicBrainz...`);
            let musicbrainz = null;
            try {
                musicbrainz = await lookupRecording(acoustId.recording.id);
            } catch (mbError) {
                console.error("[Recognition] MusicBrainz lookup failed:", mbError);
            }

            acoustIdResult = {
                confidence: acoustId.score,
                recording: {
                    id: acoustId.recording.id,
                    title: acoustId.recording.title ?? musicbrainz?.title ?? null,
                    artist: acoustId.recording.artist ?? musicbrainz?.artist ?? null,
                    duration: acoustId.recording.duration ?? fp.duration,
                },
                album: musicbrainz?.album ?? null,
                releaseDate: musicbrainz?.releaseDate ?? null,
                isrc: musicbrainz?.isrc ?? null,
                genres: musicbrainz?.genres ?? [],
                cover: null,
                shazamUrl: null,
            };
        }
    } catch (error) {
        console.error("[Recognition] Chromaprint/AcoustID/MusicBrainz flow failed:", error);
    }

    console.log(acoustIdResult);

    const hasCompleteMetadata = !!(
        acoustIdResult?.recording.title &&
        acoustIdResult?.recording.artist &&
        acoustIdResult?.album
    );

    // Check if we have a high-confidence AcoustID result
    if (acoustIdResult && acoustIdResult.confidence >= 0.955 && hasCompleteMetadata) {
        console.log(`[Recognition] AcoustID match meets confidence threshold (>= 0.95) and have all vital info. Returning AcoustID result.`);
        return [acoustIdResult];
    }

    console.log(`[Recognition] AcoustID confidence is low or no match. Querying Shazam...`);
    let shazamResultUnified: MusicResult | null = null;
    try {
        const shazamRaw = await recognizeSong(filePath);
        shazamResultUnified = {
            confidence: 1.0, // A successful match from Shazam is considered high confidence
            recording: {
                id: null,
                title: shazamRaw.title,
                artist: shazamRaw.artist,
                duration: duration ?? null,
            },
            album: shazamRaw.album,
            releaseDate: shazamRaw.released,
            isrc: shazamRaw.isrc,
            genres: shazamRaw.genre ? [shazamRaw.genre] : [],
            cover: shazamRaw.coverHQ || shazamRaw.cover || null,
            shazamUrl: shazamRaw.shazamUrl || null,
        };
        console.log("[Recognition] Shazam match found:", shazamRaw.title);
    } catch (shazamError) {
        console.error("[Recognition] Shazam recognition failed:", shazamError);
    }

    console.log(shazamResultUnified);

    const results: MusicResult[] = [];
    if (acoustIdResult) {
        results.push(acoustIdResult);
    }
    if (shazamResultUnified) {
        results.push(shazamResultUnified);
    }

    return results;
}

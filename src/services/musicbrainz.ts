// src/services/musicbrainz.ts

import axios from "axios";

export interface MusicBrainzResult {
    album: string | null;
    releaseDate: string | null;
    isrc: string | null;
    genres: string[];
}

export async function lookupRecording(
    recordingId: string
): Promise<MusicBrainzResult> {

    try {

        const { data } = await axios.get(
            `https://musicbrainz.org/ws/2/recording/${recordingId}`,
            {
                params: {
                    fmt: "json",
                    inc: "releases+isrcs+genres",
                },
                headers: {
                    "User-Agent":
                        "MusicFinder/1.0 (henry@example.com)",
                },
                timeout: 10000,
            }
        );

        return {
            album:
                data.releases?.[0]?.title ?? null,

            releaseDate:
                data.releases?.[0]?.date ?? null,

            isrc:
                data.isrcs?.[0] ?? null,

            genres:
                (data.genres ?? []).map(
                    (genre: any) => genre.name
                ),
        };

    } catch (error) {

        if (axios.isAxiosError(error)) {

            console.error("========== MUSICBRAINZ ERROR ==========");
            console.error("Status:", error.response?.status);
            console.dir(error.response?.data, {
                depth: null,
            });

        }

        throw error;
    }

}
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

export async function recognizeSong(
    filePath: string
): Promise<MusicRecognitionResult> {

    const form = new FormData();

    form.append("file", fs.createReadStream(filePath), {
        filename: "audio.mp3",
        contentType: "audio/mpeg",
    });

    try {

        const { data } = await axios.post(
            "https://shazam-core.p.rapidapi.com/v1/tracks/recognize",
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
                    "X-RapidAPI-Host": process.env.RAPIDAPI_HOST,
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
            console.log("Status:", error.response?.status);
            console.dir(error.response?.data, { depth: null });
        }

        throw error;
    }
}
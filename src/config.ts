export interface MusicResult {
    confidence: number;

    recording: {
        id: string | null;
        title: string | null;
        artist: string | null;
        duration: number | null;
    };

    album: string | null;
    releaseDate: string | null;
    isrc: string | null;
    genres: string[];
    cover: string | null;
    shazamUrl: string | null;
}

export type RecognizeResult = MusicResult[];
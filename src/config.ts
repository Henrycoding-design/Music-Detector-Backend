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
    links?: PlatformLinks;
}

export type RecognizeResult = MusicResult[];

export interface PlatformLinks {
  spotify: string | null;
  appleMusic: string | null;
  youtube: string | null;
}
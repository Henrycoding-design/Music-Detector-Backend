import type { MusicResult, PlatformLinks, RecognizeResult } from "../config.js";

/**
 * Worker 1: Queries iTunes Search API for the Apple Music track link.
 */
async function fetchItunesLink(
  title: string,
  artist: string
): Promise<string | null> {
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", `${title} ${artist}`);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[PlatformLinks] iTunes HTTP ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json") && !contentType.includes("javascript")) {
        console.error(`[PlatformLinks] iTunes unexpected content-type: ${contentType}`);
        return null;
    }

    const data = (await res.json()) as {
      results?: Array<{ trackViewUrl?: string }>;
    };

    return data.results?.[0]?.trackViewUrl ?? null;
  } catch (error) {
    console.error("[PlatformLinks] iTunes worker failed:", error);
    return null;
  }
}

/**
 * Worker 2: Queries YouTube Data API v3 using "<title> <artist> official".
 */
async function fetchYoutubeLink(
  title: string,
  artist: string,
  youtubeApiKey: string
): Promise<string | null> {
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("q", `${title} ${artist} official`);
    url.searchParams.set("key", youtubeApiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[PlatformLinks] YouTube HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      items?: Array<{ id?: { videoId?: string } }>;
    };

    const videoId = data.items?.[0]?.id?.videoId;
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  } catch (error) {
    console.error("[PlatformLinks] YouTube worker failed:", error);
    return null;
  }
}

/**
 * Builds the direct Spotify search URL from the track title and artist.
 */
function buildSpotifySearchUrl(title: string, artist: string): string {
  const query = encodeURIComponent(`${title} ${artist}`.trim());
  return `https://open.spotify.com/search/${query}`;
}

/**
 * Main helper: Takes a single MusicResult and resolves all platform links in parallel.
 */
export async function resolvePlatformLinks(
  result: MusicResult,
  youtubeApiKey = process.env.YOUTUBE_API_KEY ?? ""
): Promise<PlatformLinks> {
  const title = result.recording.title?.trim();
  const artist = result.recording.artist?.trim();

  if (!title || !artist) {
    return { spotify: null, appleMusic: null, youtube: null };
  }

  const [appleMusic, youtube] = await Promise.all([
    fetchItunesLink(title, artist),
    youtubeApiKey
      ? fetchYoutubeLink(title, artist, youtubeApiKey)
      : Promise.resolve(null),
  ]);

  return {
    spotify: buildSpotifySearchUrl(title, artist),
    appleMusic,
    youtube,
  };
}

/**
 * Convenience wrapper: Enriches the full array returned by your recognize() pipeline.
 */
export async function attachLinksToResults(
  results: MusicResult[],
  youtubeApiKey = process.env.YOUTUBE_API_KEY ?? ""
): Promise<RecognizeResult> {
  return Promise.all(
    results.map(async (item) => ({
      ...item,
      links: await resolvePlatformLinks(item, youtubeApiKey),
    }))
  );
}

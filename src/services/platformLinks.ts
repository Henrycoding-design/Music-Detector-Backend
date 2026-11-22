import type { MusicResult, PlatformLinks, RecognizeResult, ItunesTrack} from "../config.js";

const NOISE =
  /\b(feat|ft|featuring|with|remaster(ed)?|live|remix|version|edit|mono|stereo|deluxe|bonus|radio|explicit|clean|acoustic|instrumental)\b/i;

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalize = (s: string): string => {
  const stripped = s
    // drop (...) or [...] only if it contains a noise word
    .replace(/[\(\[][^\)\]]*[\)\]]/g, (m) => (NOISE.test(m) ? "" : m))
    // drop "- Remastered 2011", "- Live at ...", but keep "- Part II"
    .replace(/\s[-–—]\s(?=[^-–—]*$)(.*)$/, (m, tail) =>
      NOISE.test(tail) ? "" : m
    )
    // drop trailing "feat. X" / "ft. X" with no parentheses
    .replace(/\s(feat\.?|ft\.?|featuring)\s.*$/i, "");

  const result = clean(stripped);
  return result || clean(s); // never return an empty string
};

/**
 * Worker 1: Queries iTunes Search API for the Apple Music track link. Added scoring logics and title + artist normalization for best retrieval match. 
 */
async function fetchItunesLink(
  title: string,
  artist: string,
  country: string = "us"
): Promise<string | null> {
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", `${title}`);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("country", country);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = (await res.json()) as { results?: ItunesTrack[] };
    const wantTitle = normalize(title);
    const wantArtist = normalize(artist);

    // console.log( debug only, this would flood logs on prod
    //   "[PlatformLinks] iTunes data",
    //   JSON.stringify(
    //     data,
    //     null,
    //     2
    //   )
    // );

    const scored = (data.results ?? [])
      .map((r) => {
        const t = normalize(r.trackName ?? "");
        const a = normalize(r.artistName ?? "");
        let score = 0;
        if (t === wantTitle) score += 3;
        else if (t.includes(wantTitle) || wantTitle.includes(t)) score += 1;
        if (a === wantArtist) score += 3;
        else if (a.includes(wantArtist) || wantArtist.includes(a)) score += 1;
        // penalize covers/karaoke/tributes
        if (/karaoke|tribute|cover|instrumental/i.test(
          `${r.trackName} ${r.collectionName} ${r.artistName}`
        )) score -= 4;
        return { r, score };
      })
      .sort((x, y) => y.score - x.score);

    console.log(
      "[PlatformLinks] iTunes scored",
      JSON.stringify(
        {
          title,
          artist,
          wantTitle,
          wantArtist,
          country,
          candidates: scored.slice(0, 5).map(({ r, score }) => ({
            score,
            track: r.trackName,
            artist: r.artistName,
            album: r.collectionName,
          })),
        },
        null,
        2
      )
    );

    // require both title and artist to match reasonably
    return scored[0] && scored[0].score >= 4
      ? scored[0].r.trackViewUrl ?? null
      : null;
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
  country: string = "us",
  youtubeApiKey = process.env.YOUTUBE_API_KEY ?? ""
): Promise<PlatformLinks> {
  const title = result.recording.title?.trim();
  const artist = result.recording.artist?.trim();

  if (!title || !artist) {
    return { spotify: null, appleMusic: null, youtube: null };
  }

  const [appleMusic, youtube] = await Promise.all([
    fetchItunesLink(title, artist, country),
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
 * Convenience wrapper: Enriches the full array returned by the recognize() pipeline.
 */
export async function attachLinksToResults(
  results: MusicResult[],
  country: string = "us",
  youtubeApiKey = process.env.YOUTUBE_API_KEY ?? ""
): Promise<RecognizeResult> {
  return Promise.all(
    results.map(async (item) => ({
      ...item,
      links: await resolvePlatformLinks(item, country, youtubeApiKey),
    }))
  );
}

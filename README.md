# 🎵 Music Finder Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A free and open-source music recognition backend built with **Node.js** and **TypeScript**.

Instead of relying on a single provider, this project combines multiple recognition services into one unified pipeline to achieve reliable results while keeping API costs low.

> [!NOTE]  
> This backend handles the core heavy lifting of downloading, extraction, noise-reduction filtering, transcoding, and service fallback. It is perfect for integration with custom web apps, desktop components, or mobile frontends.

> [!IMPORTANT]
> **YouTube/URL recognition on cloud hosts (e.g. Render) requires a proxy.**
>
> YouTube blocks datacenter IP ranges, including Render's. Without a proxy, `/urlRecognize` fails with `HTTP 429` / `HTTP 403 Forbidden` and `Failed to extract any player response`, no matter how fresh the cookies are. Cookies, PO tokens, newer `yt-dlp` builds, other player clients and a different Render region do **not** fix it. See [issue #1](https://github.com/Henrycoding-design/Music-Detector-Backend/issues/1) for the full investigation.
>
> **Fix:** set `PROXY_URL` to an HTTP proxy **and** `USE_PROXY=true`. `PROXY_URL` alone is ignored. All `yt-dlp` traffic is then routed through the proxy.
>
> - ✅ **Local:** works without a proxy (residential IPs are generally trusted).
> - ✅ **Cloud + proxy:** works. Verified on Render with a free-tier datacenter proxy (Webshare). Residential proxies are more reliable long term.
> - ✅ **Unaffected:** `/recognize` and `/recordingRecognize` never use `yt-dlp` or the proxy.

> [!TIP]
> **Looking for a ready-to-use client?**
>
> A cross-platform Flutter demo client is available at:
>
> **https://github.com/Henrycoding-design/Music-Detector-Flutter**
>
> It demonstrates how to integrate this backend into a modern application, featuring:
> - 📁 Local audio file recognition
> - 🎤 Audio recording and recognition
> - 🔗 Media URL recognition (YouTube, Instagram, TikTok, etc.)
> - 🌙 Light & Dark theme
> - 📱 Cross-platform support (Android, iOS, Windows, macOS, Linux, Web)

---

## ✨ Features

* 🎼 Audio fingerprinting using **Chromaprint (fpcalc)**
* 🔍 Song identification through **AcoustID**
* 📚 Metadata enrichment using **MusicBrainz**
* 🎧 Automatic fallback to **Shazam RapidAPI** when open databases cannot confidently identify a track
* 🎙️ Dedicated noise-reduction and normalization pipeline for recorded/microphone audio (using **ARNNDN** recurrent neural network model & FFmpeg filters)
* 🔗 Platform links (Spotify, Apple Music, YouTube) attached to every result
* 📦 Unified response format regardless of the recognition source
* 🚀 REST API built with Express
* 🔒 Fully typed with TypeScript

---

## Production Reliability

The backend includes several production-oriented reliability mechanisms:

- 🔄 Automatic YouTube session cookie validation and refresh via **Heartbeat**
- ❤️ Health-check endpoint designed for uptime monitors (e.g. UptimeRobot)
- 🔑 Multi-key failover for RapidAPI
- 💾 Binary auto-management across Windows and Linux
- 📈 Memory usage logging for long-running deployments
- ⚠️ Graceful API fallback when providers are temporarily unavailable
- 🌐 Optional proxy support for `yt-dlp` (`PROXY_URL` and `USE_PROXY`) to work around cloud IP blocking
- ⏱️ Duration guard: videos longer than 8 minutes and live streams are rejected before download

### 💓 Heartbeat & Cookie Validation Flow

> [!NOTE]
> The heartbeat was originally built to keep YouTube session cookies alive on Render. It could not fix IP-level blocking, which is now handled by `PROXY_URL`. Cookies are **optional** and only needed if YouTube returns "Sign in to confirm you're not a bot". The heartbeat is optional too. If you enable it, note that it also sends requests through the proxy and consumes its bandwidth quota.

When deploying to serverless or cloud platforms like **Render**, YouTube often flags or blocks requests coming from data center IP ranges. To bypass this, the backend uses YouTube session cookies. However, these cookies expire or become invalid over time. 

The `/api/keep-alive` heartbeat endpoint acts as a proactive mechanism to solve this. Triggered by a remote cron/uptime monitor, it systematically verifies and refreshes your session cookies before real user requests hit the backend.

```text
Heartbeat Request Triggered
             │
             ▼
Download small test audio (via yt-dlp)
             │
             ▼
    Is Cookie Valid?
             │
     ┌───────┴───────┐
     │               │
    Yes             No
     │               │
     │               ▼
     │        Refresh Cookies
     │               │
     └───────┬───────┘
             │
             ▼
     Success Response
```

> [!IMPORTANT]
> **Local Testing vs Deployed Render Requests:** 
> Local testing (**DO NOT need cookie validation**), as your domestic residential IP is usually trusted by YouTube. This feature exists strictly to ensure that requests deployed on cloud instances (like Render) remain valid and are not rejected or rate-limited by YouTube's data center blocks.

---

## Recognition Pipelines

The backend provides tailored pipelines for both standard media/clean audio files and noisy microphone recordings.

### 1. Standard Audio & URL Recognition Pipeline (`/recognize`, `/urlRecognize`)

```text
URL Input (YouTube / Instagram / etc.) or Standard Audio File
     │
     ▼
yt-dlp (extract audio) / Direct File Upload
     │
     ▼
FFmpeg (MP3 conversion + normalization: 128kbps)
     │
     ▼
Audio File
     │
     ▼
Chromaprint (fpcalc)
     │
     ▼
AcoustID
     │
     │                                            
     ▼                                            
MusicBrainz     
     ├─────────────── Score ≥ 0.90 ───────────────┐ 
     │                                            │
     ▼                                            ▼
Shazam API                                 Return Result (MusicBrainz) 
     │
     ▼
Return Results (Shazam API + MusicBrainz)

If AcoustID confidence is low or no match:
               │
               ▼
          Shazam API
               │
               ▼
          Final result(s)
               │
               ▼
          Platform Links enrichment (platformLinks.ts)
          ├── Apple Music: iTunes Search API (storefront from ISRC country code, scored match)
          ├── YouTube: Data API v3 (needs YOUTUBE_API_KEY)
          └── Spotify: search URL built from title + artist
               │
               ▼
          Return Result (Shazam API (if any) + MusicBrainz (if any))
```

### 2. Recording Audio Recognition Pipeline (`/recordingRecognize`)

When audio is captured via microphone or recorded in noisy environments, raw acoustic fingerprints often fail due to background noise and low frequency hums. The recording pipeline applies targeted noise suppression before recognition:

```text
Microphone / Recorded Audio File Upload
     │
     ▼
FFmpeg Audio Normalization & Denoising Pipeline
 ├── High-pass Filter (removes rumble < 80Hz)
 ├── afftdn (FFT-based audio denoiser)
 ├── arnndn (RNN Neural Noise Reduction with models/arnndn/std.rnnn)
 └── Silence Removal (trims leading silence < -50dB)
     │
     ▼
Clean 16-bit 44.1kHz PCM WAV
     │
     ▼
Chromaprint (fpcalc)
     │
     ▼
AcoustID ──► MusicBrainz (Score ≥ 0.90) ──► Return Result
     │
     └──────► Confidence < 0.90 / No Match ──► Shazam API ──► Return Result
```

The backend is designed to support multiple candidate results when confidence is uncertain.

---

## Tech Stack

### Backend

* Node.js
* TypeScript
* Express
* Axios
* Multer

### Recognition Services

* Chromaprint (fpcalc)
* AcoustID
* MusicBrainz
* Shazam API (fallback)
* iTunes Search API
* Youtube API v3

### Normalization & Denoising Services

* FFmpeg & FFprobe
* ARNNDN (RNN-based neural noise suppression using `models/arnndn/std.rnnn`)

### Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Henrycoding-design/Music-Detector-Backend)

This project is tailored to work out-of-the-box on **Render**.

**Render Build Command:**

```bash
mkdir -p bin/linux && \
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/linux/yt-dlp && \
curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz | tar -xJ --wildcards --strip-components=2 -C bin/linux/ '*/bin/ffmpeg' '*/bin/ffprobe' && \
curl -L https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-linux-x86_64.tar.gz | tar -xz --strip-components=1 -C bin/linux/ chromaprint-fpcalc-1.5.1-linux-x86_64/fpcalc && \
chmod +x bin/linux/* && \
npm install && \
npm run build
```

> [!IMPORTANT]
> **Keep the binary download step in the Render Build Command.**
>
> The backend depends on external binaries such as **yt-dlp**, FFmpeg, and Chromaprint. In particular, YouTube extraction behavior can change over time, and an outdated `yt-dlp` binary may suddenly stop working even when the backend code, cookies, and configuration are unchanged.
>
> The Render build command intentionally downloads the **latest yt-dlp release on every rebuild**. Do not replace this with a permanently pinned or manually uploaded binary unless there is a specific reason to do so.
>
> **If YouTube extraction suddenly starts failing after previously working normally, it's recommended to rebuild the Render service first to refresh the yt-dlp binary before troubleshooting cookies or rewriting the downloader.**

**Render Start Command:**

```bash
npm run start
```

---

## Project Structure

```text
src/
│
├── routes/
│   ├── heartbeat.ts
│   ├── recognize.ts
│   ├── recordingRecognize.ts
│   └── urlRecognize.ts
│
├── services/
│   ├── acoustid.ts
│   ├── chromaprint.ts
│   ├── downloader.ts
│   ├── executableManager.ts
│   ├── memoryLogger.ts
│   ├── musicbrainz.ts
│   ├── normalizer.ts
│   ├── platformLinks.ts
│   ├── recognition.ts
│   └── shazam.ts
│
├── config.ts
└── index.ts
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Henrycoding-design/Music-Detector-Backend.git
cd Music-Detector-Backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
ACOUSTID_API_KEY=your_key
RAPIDAPI_KEY=your_key
RAPIDAPI_KEYS=your_key1,your_key2
RAPIDAPI_HOST=shazam.p.rapidapi.com
HEARTBEAT_SECRET=your_heartbeat_secret
# Optional. Required on cloud hosts such as Render. Keep it in env vars/secrets.
PROXY_URL=http://username:password@host:port
# Optional. Set to true to route yt-dlp through PROXY_URL (default: false)
USE_PROXY=true
# Optional. Enables YouTube links in results. Without it, links.youtube is null
YOUTUBE_API_KEY=your_youtube_data_api_key
```

> [!NOTE]
> You can provide either `RAPIDAPI_KEYS` (comma-separated for horizontal scale and failover rotation) or a traditional singular `RAPIDAPI_KEY`. The system prioritizes multi-keys first and fallbacks to the singular variant.
> `HEARTBEAT_SECRET` is used to make sure the request is coming from an authorized client, preventing random requests from accidentally triggering your `yt-dlp` download and cookie refreshing loop. Skip if you do not use the `/api/keep-alive` endpoint.
> Filling `PROXY_URL` but left `USE_PROXY` undefined will NOT trigger the proxy routing pipeline. Make sure you correctly configured both.

### 4. Binary Executables

The system automatically handles production binaries via the Render build script. For **local development**, ensure the platform-appropriate executable files are placed in the `bin/` directory:

```text
bin/
    linux/
        ffmpeg
        ffprobe
        fpcalc
        yt-dlp
        
    windows/
        ffmpeg.exe
        ffprobe.exe
        fpcalc.exe
        yt-dlp.exe
```

---

## Development

Run the local development server (with hot-reloading via `ts-node-dev`):

```bash
npm run dev
```

Build the TypeScript project into native JavaScript:

```bash
npm run build
```

Run the production compiled build:

```bash
npm start
```

---

## API Documentation

### GET/POST `/api/keep-alive`

Triggers the heartbeat check to test and refresh deployment session cookies using a light test audio stream. This endpoint is typically targeted by external cron jobs or uptime checkers like UptimeRobot.

* **Query Parameters or JSON body fields:**
  * `token`: The secret key matching your configured `HEARTBEAT_SECRET` env variable.
  * `url`: A reliable fallback YouTube URL used to perform the diagnostic audio chunk fetch.

**Example Monitor Configuration (e.g., UptimeRobot HEAD/GET):**

```text
https://music-detector-backend.onrender.com/api/keep-alive?token=your_secret&url=https://www.youtube.com/watch?v=1kehqCLudyg
```

---

### POST `/recognize`

Upload a raw audio file binary using `multipart/form-data`.

* **Field Name:** `file`

**Example Usage:**

```bash
curl -X POST \
  -F "file=@song.mp3" \
  http://localhost:3000/recognize
```

---

### POST `/recordingRecognize`

Upload a noisy audio sample or microphone recording binary using `multipart/form-data`. The backend applies high-pass filtering, FFT noise suppression, RNN deep learning noise reduction (`arnndn`), and silence removal to produce clean PCM WAV before recognition.

* **Field Name:** `file`
* **Supported Extensions:** `.mp3`, `.wav`, `.flac`, `.m4a`, `.aac`, `.ogg` (up to 10MB)

**Example Usage:**

```bash
curl -X POST \
  -F "file=@recording.wav" \
  http://localhost:3000/recordingRecognize
```

---

### POST `/urlRecognize`

Send a public media link (YouTube, Instagram, TikTok, etc.) to trigger stream parsing.

* **Headers:** `Content-Type: application/json`
* **Limits:** videos longer than **8 minutes** and **live streams** are rejected before download (`VIDEO_TOO_LONG`) to save proxy bandwidth and disk. Change `MAX_DURATION_SECONDS` in `src/services/downloader.ts` to adjust.

**Example Request:**

```bash
curl -X POST http://localhost:3000/urlRecognize \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

---

## Example Response

```json
{
  "success": true,
  "result": [
    {
      "confidence": 0.97910076,
      "recording": {
        "id": "7d45d272-2bf9-4c06-bf0c-4e42583b96f2",
        "title": "Faded",
        "artist": "Alan Walker",
        "duration": 212
      },
      "album": "Faded",
      "releaseDate": "2015-12-03",
      "isrc": "NOG841549010",
      "genres": [ "downtempo", "electro house", "electropop", "pop" ],
      "cover": null,
      "shazamUrl": null,
      "links": {
        "spotify": "https://open.spotify.com/search/Faded%20Alan%20Walker",
        "appleMusic": "https://music.apple.com/no/album/faded/1196294554?i=1196294581&uo=4",
        "youtube": "https://www.youtube.com/watch?v=60ItHLz5WEA"
      }
    }
  ]
}
```
---

## 🔗 Platform Links

Every result returned by `/recognize`, `/recordingRecognize` and `/urlRecognize` is enriched with a `links` object pointing to the song on Spotify, Apple Music and YouTube. The links are resolved from the final recognized title and artist by `src/services/platformLinks.ts`, after the AcoustID or Shazam step.

```json
"links": {
  "spotify": "https://open.spotify.com/search/Love%20Story%20Taylor%20Swift",
  "appleMusic": "https://music.apple.com/us/album/love-story/...",
  "youtube": "https://www.youtube.com/watch?v=..."
}
```

Each field is a `string` or `null`. Always handle `null` on the client.

| Field | How it is resolved | When it is `null` |
|---|---|---|
| `spotify` | Search URL built from title + artist | Only when the title or artist is missing |
| `appleMusic` | iTunes Search API, best-scoring candidate | No confident match (see below), or the API call failed |
| `youtube` | YouTube Data API v3 search for `<title> <artist> official`, first result | `YOUTUBE_API_KEY` is not set, quota is exhausted, or the API call failed |

### Behavior to be aware of

- **Spotify is a search URL, not a direct track link.** It opens Spotify's search page for the song. The backend does not call the Spotify API, so no Spotify credentials are needed.
- **Apple Music can be `null` when no confident match is found.** iTunes returns up to 10 candidates. Titles and artists are normalized first (feat. credits, "Remastered", "Live", "Deluxe" and similar tags are stripped) and then scored:
  - exact title match: +3, partial match: +1
  - exact artist match: +3, partial match: +1
  - candidates whose track, album or artist name contains `karaoke`, `tribute`, `cover` or `instrumental`: −4

  A link is returned only if the best candidate scores **4 or higher**, so a title match alone is never enough. A wrong link is considered worse than no link.
- **YouTube is `null` without `YOUTUBE_API_KEY`.** Set it in your environment to enable YouTube links. The result is simply the first search hit, so it is not guaranteed to be the official upload. Each lookup is a `search.list` call, which costs 100 quota units, so the default daily quota of 10,000 units allows roughly 100 lookups per day (one per guess, so a response with two guesses uses two).
- **Results with no title or artist get all links set to `null`.** Nothing is searched in that case, including Spotify.
- **The Apple Music storefront country comes from the ISRC.** The first two letters of the ISRC of the first result are used as the iTunes country code (for example `USCJY0803276` → `us`). If there is no ISRC, the default is `us`. The same storefront is used for every result in the response. Note that an ISRC prefix identifies where the recording was registered, which is not always the storefront where the song is sold, so a mismatch can occasionally produce `null`.

> [!NOTE]
> Link resolution never fails the request. If iTunes or YouTube errors out, the corresponding field is `null` and the rest of the result is returned normally. Because lookups run after recognition, they add a small amount of latency to every response.

---

## Response Strategy

The backend optimization follows a confidence-based routing flow:

* **High-confidence AcoustID match (≥ 0.90):** Drops execution immediately and relies purely on AcoustID + MusicBrainz open-source layers (0 API cost).
* **Low-confidence or no AcoustID match:** Falls back cleanly to Shazam RapidAPI endpoints to handle noisy/microphone audio samples.

> [!WARNING]
> Do not intentionally trim or slice the original file length on ingestion for clean files. Slicing structural intervals can break continuous wave patterns that AcoustID requires to produce high confidence fingerprint matches.

---

## 🔧 Troubleshooting YouTube / yt-dlp Extraction

If `/urlRecognize` fails with errors like:

```text
HTTP Error 429: Too Many Requests
HTTP Error 403: Forbidden
Failed to extract any player response
```

**Recommended order:**
1. **Does it work locally?** If yes and it fails only on the cloud host, the host's IP is blocked. Set `PROXY_URL` (see above).
2. **Already using a proxy?** Check that the proxy isn't out of bandwidth, then rotate to another IP from the pool. If datacenter IPs keep getting blocked, move to a residential proxy.
3. **Fails everywhere, including locally?** Rebuild the service to pull the latest `yt-dlp` binary and verify with `yt-dlp --version`.
4. **"Sign in to confirm you're not a bot"?** Only then provide session cookies, and test them separately from other changes.
5. **Still failing?** Consider a PO token provider such as [bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider).

> [!NOTE]
> Using proxies to access YouTube may conflict with YouTube's Terms of Service. This is fine for personal and testing use but fragile for a public service.

---

## Roadmap

* [x] Chromaprint integration
* [x] AcoustID integration
* [x] MusicBrainz integration
* [x] Shazam fallback
* [x] Unified recognition pipeline
* [x] yt-dlp integration
* [x] FFmpeg preprocessing
* [x] Multi-key failover fallback mechanism for Shazam RapidAPI
* [x] Added Memory Logger for a one-off snapshot of current RAM usage to console
* [x] Automated Cookie Keep-Alive validation flow
* [x] Dedicated normalization and detection pipeline for recorded audio
* [x] Proxy support for `yt-dlp` to work around cloud IP blocking
* [x] Duration and live-stream guard for URL recognition
* [x] Spotify / Apple Music / YouTube link retrieval

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Henrycoding-design/Music-Detector-Backend/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgements

This project is built upon the work of excellent open-source and public services:

* [Chromaprint](https://acoustid.org/chromaprint)
* [AcoustID](https://acoustid.org/)
* [MusicBrainz](https://musicbrainz.org/)
* [Shazam API](https://rapidapi.com/)
* [FFmpeg](https://ffmpeg.org/)
* [yt-dlp](https://github.com/yt-dlp/yt-dlp)

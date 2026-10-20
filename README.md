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
> **Fix:** set the `PROXY_URL` environment variable to an HTTP proxy. All `yt-dlp` traffic is routed through it.
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
- 🌐 Optional proxy support for `yt-dlp` (`PROXY_URL`) to work around cloud IP blocking
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
     ├─────────────── Score ≥ 0.95 ───────────────┐ 
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
AcoustID ──► MusicBrainz (Score ≥ 0.95) ──► Return Result
     │
     └──────► Confidence < 0.95 / No Match ──► Shazam API ──► Return Result
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
```

> [!NOTE]
> You can provide either `RAPIDAPI_KEYS` (comma-separated for horizontal scale and failover rotation) or a traditional singular `RAPIDAPI_KEY`. The system prioritizes multi-keys first and fallbacks to the singular variant.
> `HEARTBEAT_SECRET` is used to make sure the request is coming from an authorized client, preventing random requests from accidentally triggering your `yt-dlp` download and cookie refreshing loop. Skip if you do not use the `/api/keep-alive` endpoint.

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
      "confidence": 0.97204643,
      "recording": {
        "id": "1e141b98-eed4-4312-9f72-4efc61ed24df",
        "title": "Love Story",
        "artist": "Taylor Swift",
        "duration": 234
      },
      "album": "Fearless",
      "releaseDate": "2008-11-11",
      "isrc": "USCJY0803276",
      "genres": [],
      "cover": null,
      "shazamUrl": null
    }
  ]
}
```

---

## Response Strategy

The backend optimization follows a confidence-based routing flow:

* **High-confidence AcoustID match (≥ 0.95):** Drops execution immediately and relies purely on AcoustID + MusicBrainz open-source layers (0 API cost).
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

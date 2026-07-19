# 🎵 Music Finder Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-blue.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A free and open-source music recognition backend built with **Node.js** and **TypeScript**.

Instead of relying on a single provider, this project combines multiple recognition services into one unified pipeline to achieve reliable results while keeping API costs low.

> [!NOTE]  
> This backend handles the core heavy lifting of downloading, extraction, transcoding, and service fallback. It is perfect for integration with custom web apps, desktop components, or mobile frontends.

> [!TIP]
> **Looking for a ready-to-use client?**
>
> A cross-platform Flutter demo client is available at:
>
> **https://github.com/Henrycoding-design/Music-Detector-Flutter**
>
> It demonstrates how to integrate this backend into a modern application, featuring:
> - 📁 Local audio file recognition
> - 🔗 Media URL recognition (YouTube, Instagram, TikTok, etc.)
> - 🌙 Light & Dark theme
> - 📱 Cross-platform support (Android, iOS, Windows, macOS, Linux, Web)
<!-- > - 🎤 Audio recording and recognition (Future) -->

---

## ✨ Features

* 🎼 Audio fingerprinting using **Chromaprint (fpcalc)**
* 🔍 Song identification through **AcoustID**
* 📚 Metadata enrichment using **MusicBrainz**
* 🎧 Automatic fallback to **Shazam RapidAPI** when open databases cannot confidently identify a track
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

### 💓 Heartbeat & Cookie Validation Flow

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

## Recognition Pipeline

```text
URL Input (YouTube / Instagram / etc.)
     │
     ▼
yt-dlp (extract audio)
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

### Normalization Service

* FFmpeg & FFprobe

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
│   ├── urlRecognize.ts
│   └── recognize.ts
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
https://music-detector-backend.onrender.com/api/keep-alive?token=MusicFinderBackendHearbeatSecret&url=https://www.youtube.com/watch?v=1kehqCLudyg

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

### POST `/urlRecognize`

Send a public media link (YouTube, Instagram, TikTok, etc.) to trigger stream parsing.

* **Headers:** `Content-Type: application/json`

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
> Do not intentionally trim or slice the original file length on ingestion. Slicing structural intervals can break continuous wave patterns that AcoustID requires to produce high confidence fingerprint matches.

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
* [ ] Dedicated normalization and detection pipeline for recorded audio 

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://www.google.com/search?q=https://github.com/Henrycoding-design/Music-Detector-Backend/issues).

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

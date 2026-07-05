# 🎵 Music Finder Backend

A free and open-source music recognition backend built with **Node.js** and **TypeScript**.

Instead of relying on a single provider, this project combines multiple recognition services into one unified pipeline to achieve reliable results while keeping API costs low.

## ✨ Features

* 🎼 Audio fingerprinting using **Chromaprint (fpcalc)**
* 🔍 Song identification through **AcoustID**
* 📚 Metadata enrichment using **MusicBrainz**
* 🎧 Automatic fallback to **Shazam RapidAPI** when open databases cannot confidently identify a track
* 📦 Unified response format regardless of the recognition source
* 🚀 REST API built with Express
* 🔒 Fully typed with TypeScript

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

### Deployment

* Render

Render build command:
```bash
mkdir -p bin/linux && \
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/linux/yt-dlp && \
curl -L https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz | tar -xJ --wildcards --strip-components=1 -C bin/linux/ "*/ffmpeg" "*/ffprobe" && \
curl -L https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-linux-x86_64.tar.gz | tar -xz --strip-components=1 -C bin/linux/ chromaprint-fpcalc-1.5.1-linux-x86_64/fpcalc && \
chmod +x bin/linux/* && \
npm install && \
npm run build
```

Render start command:
```bash
npm run start
```

---

## Project Structure

```text
src/
│
├── routes/
│   ├── urlRecognize.ts
│   └── recognize.ts
│
├── services/
│   ├── chromaprint.ts
│   ├── acoustid.ts
│   ├── musicbrainz.ts
│   ├── shazam.ts
│   ├── downloader.ts
│   ├── executableManager.ts
│   ├── normalizer.ts
│   └── recognition.ts
│
├── config.ts
└── index.ts
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/Henrycoding-design/Music-Detector-Backend.git
cd Music-Detector-Backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
ACOUSTID_API_KEY=your_key
RAPIDAPI_KEY=your_key
RAPIDAPI_HOST=your_host
```

Make sure the executables files are in the `bin/` directory:

```
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

Run the development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run production:

```bash
npm start
```

---

## API

### POST `/recognize`

Upload an audio file using multipart form-data.

Field name:

```
file
```

Example:

For audio file:
```bash
curl -X POST \
  -F "file=@song.mp3" \
  http://localhost:3000/recognize
```

### POST `/urlRecognize`

Upload Youtube/Instagram link for audio detection.

For Youtube/Instagram links:
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

The backend follows a confidence-based decision flow:

* **High-confidence AcoustID match (≥ 0.95)**
  Returns the AcoustID + MusicBrainz result.

* **Low-confidence or no AcoustID match**
  Falls back to Shazam RapidAPI.

* **Future-ready**
  Supports returning multiple candidate matches when confidence is ambiguous.

---

## Roadmap

* [x] Chromaprint integration
* [x] AcoustID integration
* [x] MusicBrainz integration
* [x] Shazam fallback
* [x] Unified recognition pipeline
* [x] yt-dlp integration
* [x] FFmpeg preprocessing

---

## License

MIT License.

---

## Acknowledgements

This project is built upon the work of several excellent open-source and public services:

* Chromaprint
* AcoustID
* MusicBrainz
* Shazam
* FFmpeg
* yt-dlp
* Express
* TypeScript

Their projects make free music recognition more accessible for everyone.

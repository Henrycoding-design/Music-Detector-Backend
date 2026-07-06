import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { ExecutableManager } from "./executableManager.js";

// Master source config from your environment variables or Render secrets
const masterCookiesPath = process.env.YOUTUBE_COOKIES_PATH ?? '/etc/secrets/youtube-cookies.txt';

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function downloadAudio(url: string): Promise<string> {
    // Ensure both download and session storage folders exist
    await fs.mkdir("downloads/session_cookies", { recursive: true });
    
    const id = crypto.randomUUID();
    const outputTemplate = path.join("downloads", `${id}.%(ext)s`);
    const ffmpegDir = path.dirname(ExecutableManager.ffmpeg);

    const args = [
        "--js-runtimes", "node",
        "--no-playlist",
        "-x",
        "--audio-format", "mp3",
        "--ffmpeg-location", ffmpegDir,
        "-o", outputTemplate
    ];

    // Writeable path that lives across multiple requests
    const activeCookiesPath = path.join("downloads", "session_cookies", "live-youtube-cookies.txt");
    
    const hasLiveCookies = await fileExists(activeCookiesPath);
    const hasMasterCookies = await fileExists(masterCookiesPath);

    if (hasLiveCookies) {
        // We have a living, rolling cookie session file. Use it directly.
        args.unshift("--cookies", activeCookiesPath);
        console.log(`[downloader] Reusing living session cookies at: ${activeCookiesPath}`);
    } else if (hasMasterCookies) {
        try {
            // First run fallback: Copy master secret to our writeable location
            await fs.copyFile(masterCookiesPath, activeCookiesPath);
            args.unshift("--cookies", activeCookiesPath);
            console.log(`[downloader] Initialized living session file copy from master secrets.`);
        } catch (copyErr) {
            console.warn("[downloader] Failed to copy master cookie file, running without cookies:", copyErr);
        }
    }

    args.push(url);

    return new Promise((resolve, reject) => {
        const yt = spawn(ExecutableManager.ytDlp, args);
        let stderr = "";

        yt.stderr.on("data", chunk => {
            stderr += chunk.toString();
        });

        yt.on("error", reject);
        yt.on("close", code => {
            if (code !== 0) {
                return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
            }
            
            resolve(path.join("downloads", `${id}.mp3`));
        });
    });
}
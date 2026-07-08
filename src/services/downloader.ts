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
    const activeCookiesPath = path.join("downloads", "session_cookies", "live-youtube-cookies.txt");

    // Helper function to build fresh arguments depending on cookie state
    async function buildArgs(): Promise<string[]> {
        const args = [
            "--js-runtimes", "node",
            "--no-playlist",
            "-x",
            "--audio-format", "mp3",
            "--ffmpeg-location", ffmpegDir,
            "-o", outputTemplate
        ];

        const hasLiveCookies = await fileExists(activeCookiesPath);
        const hasMasterCookies = await fileExists(masterCookiesPath);

        if (hasLiveCookies) {
            args.unshift("--cookies", activeCookiesPath);
            console.log(`[downloader] Reusing living session cookies at: ${activeCookiesPath}`);
        } else if (hasMasterCookies) {
            try {
                await fs.copyFile(masterCookiesPath, activeCookiesPath);
                args.unshift("--cookies", activeCookiesPath);
                console.log(`[downloader] Initialized living session file copy from master secrets.`);
            } catch (copyErr) {
                console.warn("[downloader] Failed to copy master cookie file, running without cookies:", copyErr);
            }
        }

        args.push(url);
        return args;
    }

    // Inner helper to execute yt-dlp wrapped in a Promise
    const runYtDlp = async (args: string[]): Promise<string> => {
        return new Promise((resolve, reject) => {
            const yt = spawn(ExecutableManager.ytDlp, args);
            let stderr = "";
            let stdout = ""; // yt-dlp occasionally puts warnings/errors into stdout depending on config

            yt.stdout.on("data", chunk => { stdout += chunk.toString(); });
            yt.stderr.on("data", chunk => { stderr += chunk.toString(); });

            yt.on("error", reject);
            yt.on("close", code => {
                const fullLog = stdout + "\n" + stderr;
                if (code !== 0) {
                    return reject(new Error(fullLog || `yt-dlp exited with code ${code}`));
                }
                resolve(path.join("downloads", `${id}.mp3`));
            });
        });
    };

    try {
        // --- Attempt 1 ---
        const initialArgs = await buildArgs();
        return await runYtDlp(initialArgs);
    } catch (error: any) {
        const errorMsg = error?.message || "";
        
        // Check if the error is related to broken/rotated cookies
        const isCookieError = 
            errorMsg.includes("cookies no longer valid") || 
            errorMsg.includes("rotated") || 
            errorMsg.includes("Sign in to confirm you’re not a bot");

        if (isCookieError) {
            console.warn("[downloader] Live cookies expired or rotated. Purging and retrying with master copy...");
            
            try {
                // 1. Delete the bad live cookies file
                await fs.rm(activeCookiesPath, { force: true });
                
                // 2. Rebuild arguments (this will automatically copy the master cookies file fresh)
                const retryArgs = await buildArgs();
                
                // 3. --- Attempt 2 ---
                return await runYtDlp(retryArgs);
            } catch (retryError) {
                console.error("[downloader] Retry with master cookies also failed.");
                throw retryError;
            }
        }

        // If it's a completely different error, don't try to fix cookies, just pass it up
        throw error;
    }
}
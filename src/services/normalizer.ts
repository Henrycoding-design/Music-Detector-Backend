import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ExecutableManager } from "./executableManager.js";

export async function normalizeAudio(inputPath: string): Promise<string> {
    await fs.mkdir("normalized", { recursive: true });

    const id = crypto.randomUUID();
    const outputPath = path.join("normalized", `${id}.mp3`);

    return new Promise((resolve, reject) => {

        const ffmpeg = spawn(ExecutableManager.ffmpeg, [
            "-y",

            "-i",
            inputPath,

            // try mid-section first
            // "-ss",
            // "5",
            // "-t",
            // "180",

            "-vn",
            "-acodec",
            "libmp3lame",
            "-b:a",
            "128k",
            // "-af",
            // "loudnorm",

            outputPath
        ]);

        let stderr = "";

        ffmpeg.stderr.on("data", (d) => {
            stderr += d.toString();
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || "FFmpeg fallback failed"));
            }
            resolve(outputPath);
        });

        ffmpeg.on("error", reject);
    });
}
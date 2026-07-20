import { spawn } from "child_process";
import fs from "fs/promises";
import { existsSync } from "node:fs";
import path from "path";
import crypto from "crypto";
import { ExecutableManager } from "./executableManager.js";

const arnndnModel = "models/arnndn/std.rnnn";

if (!existsSync(arnndnModel)) {
    throw new Error(`ARNNDN model not found: ${arnndnModel}`);
}

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

export async function normalizeRecording(inputPath: string): Promise<string> {

    await fs.mkdir("normalized", { recursive: true });

    const id = crypto.randomUUID();
    const outputPath = path.join("normalized", `${id}.wav`);

    // const arnndnModel = path.join(
    //     process.cwd(),
    //     "models",
    //     "arnndn",
    //     "std.rnnn"
    // );

    return new Promise((resolve, reject) => {

        const ffmpeg = spawn(ExecutableManager.ffmpeg, [
            "-y",

            "-i",
            inputPath,

            "-vn",

            "-af",
            [
                "highpass=f=80",
                "afftdn",
                `arnndn=model=${arnndnModel}`,
                "silenceremove=start_periods=1:start_duration=0.3:start_threshold=-50dB",
            ].join(","),

            "-ac",
            "1",

            "-ar",
            "44100",

            "-c:a",
            "pcm_s16le",

            outputPath,
        ]);

        let stderr = "";

        ffmpeg.stderr.on("data", (d) => {
            stderr += d.toString();
        });

        ffmpeg.on("close", (code) => {

            if (code !== 0) {
                return reject(new Error(stderr || "FFmpeg normalize recording failed"));
            }

            resolve(outputPath);

        });

        ffmpeg.on("error", reject);

    });

}
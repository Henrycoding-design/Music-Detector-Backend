import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

import { ExecutableManager } from "./executableManager.js";

export async function downloadAudio(url: string): Promise<string> {

    await fs.mkdir("downloads", { recursive: true });

    const id = crypto.randomUUID();

    const outputTemplate = path.join(
        "downloads",
        `${id}.%(ext)s`
    );

    const ffmpegDir = path.dirname(ExecutableManager.ffmpeg);

    return new Promise((resolve, reject) => {

        const yt = spawn(
            ExecutableManager.ytDlp,
            [
                "--no-playlist",

                "-x",
                "--audio-format",
                "mp3",

                // "--cookies-from-browser", "chrome",

                "--ffmpeg-location",
                ffmpegDir,

                "-o",
                outputTemplate,

                url,
            ]
        );

        let stderr = "";

        yt.stderr.on("data", chunk => {
            stderr += chunk.toString();
        });

        yt.on("error", reject);

        yt.on("close", code => {

            if (code !== 0) {
                return reject(
                    new Error(stderr || `yt-dlp exited with code ${code}`)
                );
            }

            resolve(
                path.join(
                    "downloads",
                    `${id}.mp3`
                )
            );

        });

    });

}
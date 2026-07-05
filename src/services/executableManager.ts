// src/services/executableManager.ts

import path from "path";
import os from "os";
import fs from "fs/promises";
import fsSync from "fs";

const isWindows = os.platform() === "win32";
const isRender = !!process.env.RENDER; // Render sets this env var

export class ExecutableManager {

    /**
     * Resolve system-first, fallback to local bin only for dev.
     */
    static resolve(name: string): string {

        // Render / Linux production → system packages (APT)
        if (isRender) {
            const systemPath = `/usr/bin/${name}`;
            if (fsSync.existsSync(systemPath)) return systemPath;
        }

        // Local dev fallback
        const localPath = path.join(
            process.cwd(),
            "bin",
            isWindows ? "windows" : "linux",
            isWindows ? `${name}.exe` : name
        );

        return localPath;
    }

    // Convenience getters

    static get fpcalc() {
        return this.resolve("fpcalc");
    }

    static get ytDlp() {
        return this.resolve("yt-dlp");
    }

    static get ffmpeg() {
        return this.resolve("ffmpeg");
    }

    static get ffprobe() {
        return this.resolve("ffprobe");
    }

    /**
     * Local-only permission fix (NOT needed on Render)
     */
    static async initialize(): Promise<void> {
        if (isWindows || isRender) return;

        const executables = ["fpcalc", "yt-dlp", "ffmpeg", "ffprobe"];

        await Promise.all(
            executables.map(async (executable) => {
                try {
                    await fs.chmod(this.resolve(executable), 0o755);
                } catch (err) {
                    console.warn(
                        `[ExecutableManager] chmod failed for ${executable}:`,
                        err
                    );
                }
            })
        );
    }
}
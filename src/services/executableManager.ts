// src/services/executableManager.ts

import path from "path";
import os from "os";
import fs from "fs/promises";

// Helper to determine folder names based on the OS
const getPlatformFolder = (): string => {
    const currentPlatform = os.platform();
    if (currentPlatform === "win32") return "windows";
    // if (currentPlatform === "darwin") return "macos"; Not support yet
    return "linux"; // Default for Linux / Render
};

const platformFolder = getPlatformFolder();

export class ExecutableManager {

    /**
     * Returns the absolute path to an executable stored in /bin.
     *
     * Example:
     * Windows -> /bin/windows/fpcalc.exe
     * Linux   -> /bin/linux/fpcalc
     * Mac     -> /bin/macos/fpcalc (Not-supported yet)
     */
    static getPath(name: string): string {
        const isWindows = os.platform() === "win32";
        return path.join(
            process.cwd(),
            "bin",
            platformFolder,
            isWindows ? `${name}.exe` : name
        );
    }

    /**
     * Ensures all non-Windows executables have execute permissions (755).
     * Safe to call multiple times.
     */
    static async initialize(): Promise<void> {
        // Windows binaries do not use chmod
        if (os.platform() === "win32") {
            return;
        }

        const executables = [
            "fpcalc",
            "yt-dlp",
            "ffmpeg",
            "ffprobe",
        ];

        await Promise.all(
            executables.map(async (executable) => {
                try {
                    await fs.chmod(
                        this.getPath(executable),
                        0o755
                    );
                } catch (err) {
                    console.warn(
                        `[ExecutableManager] Failed to chmod ${executable}:`,
                        err
                    );
                }
            })
        );
    }

    // Convenience getters

    static get fpcalc(): string {
        return this.getPath("fpcalc");
    }

    static get ytDlp(): string {
        return this.getPath("yt-dlp");
    }

    static get ffmpeg(): string {
        return this.getPath("ffmpeg");
    }

    static get ffprobe(): string {
        return this.getPath("ffprobe");
    }
}
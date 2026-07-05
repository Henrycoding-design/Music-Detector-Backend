// src/services/chromaprint.ts

import { execFile } from "child_process";
import { promisify } from "util";
import { ExecutableManager } from "./executableManager.js";

const execFileAsync = promisify(execFile);

export interface ChromaprintResult {
    duration: number;
    fingerprint: string;
}

export async function fingerprintAudio(
    filePath: string
): Promise<ChromaprintResult> {

    const fpcalcPath = ExecutableManager.fpcalc;

    if (process.env.NODE_ENV !== "production") {
        console.log("cwd:", process.cwd());
        console.log("fpcalc:", fpcalcPath);
    }

    try {

        const { stdout } = await execFileAsync(fpcalcPath, [filePath]);

        const result = parseFpcalcOutput(stdout);

        if (!result.duration || !result.fingerprint) {
            throw new Error("Invalid fpcalc output.");
        }

        return result;

    } catch (error) {

        if (error instanceof Error) {
            throw new Error(`Chromaprint failed: ${error.message}`);
        }

        throw new Error("Unknown Chromaprint error.");

    }
}

function parseFpcalcOutput(output: string): ChromaprintResult {

    const result: Partial<ChromaprintResult> = {};

    const lines = output.trim().split(/\r?\n/);

    for (const line of lines) {

        const index = line.indexOf("=");

        if (index === -1) continue;

        const key = line.substring(0, index);
        const value = line.substring(index + 1);

        switch (key) {

            case "DURATION":
                result.duration = Number(value);
                break;

            case "FINGERPRINT":
                result.fingerprint = value;
                break;

        }

    }

    return result as ChromaprintResult;
}
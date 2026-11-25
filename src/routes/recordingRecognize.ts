import express from "express";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
import { normalizeRecording } from "../services/normalizer.js";
import { logMemorySnapshot } from "../services/memoryLogger.js";
import { recognize } from "../services/recognition.js";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fsSync.existsSync(uploadDir)) {
    fsSync.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
    dest: "uploads/",
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter(req, file, cb) {
        const allowedExtensions = [
            ".mp3",
            ".mp4",
            ".wav",
            ".flac",
            ".m4a",
            ".aac",
            ".ogg",
            ".webm",
        ];

        const ext = path.extname(file.originalname).toLowerCase();
        const isValidMime =
            file.mimetype.startsWith("audio/") ||
            file.mimetype === "application/octet-stream";

        if (
            isValidMime &&
            allowedExtensions.includes(ext)
        ) {
            return cb(null, true);
        }

        cb(new Error("Only audio files are allowed."));
    },
});

router.post("/", upload.single("file"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: "No file uploaded",
        });
    }

    let normalized = "";

    try {
        // detect actual file bytes
        const detectedType = await fileTypeFromFile(req.file.path);
        const allowedMimes = [
            "audio/mpeg",
            "audio/wav",
            "audio/vnd.wave",
            "audio/flac",
            "audio/x-flac",
            "audio/mp4",
            "video/mp4",
            "audio/x-m4a",
            "audio/aac",
            "audio/ogg",
            "audio/webm",
            "video/webm",
        ];

        console.log(`[Recording Recognition] Detected file-type: ${JSON.stringify(detectedType)}`);

        if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
            throw new Error("Invalid file content. Only real audio files are allowed.");
        }

        // start recognition pipeline
        normalized = await normalizeRecording(req.file.path);

        const result = await recognize(normalized);

        return res.json({
            success: true,
            result,
        });

    } catch (error) {

        // if (error instanceof multer.MulterError) { this multer catch wont run, the error is catched in the err-handler middleware in index.ts instead
        //     return res.status(400).json({
        //         success: false,
        //         error: error.message,
        //     });
        // }

        if (
            error instanceof Error &&
            error.message === "Invalid file content. Only real audio files are allowed."
        ) {
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }

        console.error(error);

        return res.status(500).json({
            success: false,
            error: "Unknown error",
        });

    } finally {

        await fs.unlink(req.file.path).catch(() => {});

        if (normalized) {
            await fs.unlink(normalized).catch(() => {});
        }

        logMemorySnapshot("Recording Recognition Endpoint");
    }

});

export default router;
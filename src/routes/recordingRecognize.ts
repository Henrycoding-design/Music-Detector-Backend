import express from "express";
import multer from "multer";
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
            ".wav",
            ".flac",
            ".m4a",
            ".aac",
            ".ogg",
        ];

        const ext = path.extname(file.originalname).toLowerCase();

        if (
            file.mimetype.startsWith("audio/") ||
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

        normalized = await normalizeRecording(req.file.path);

        const result = await recognize(normalized);

        return res.json({
            success: true,
            result,
        });

    } catch (error) {

        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }

        if (error instanceof Error) {
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
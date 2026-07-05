import express from "express";
import axios from "axios"
import multer from "multer";
import { recognize } from "../services/recognition.js";
import { normalizeAudio } from "../services/normalizer.js";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const upload = multer({
    dest: "uploads/",
    limits: {fileSize: 10 * 1024 * 1024,},
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
            error: "No file uploaded"
        });
    }

    let normalized = "";

    try {

        normalized = await normalizeAudio(req.file.path);
        const result = await recognize(normalized);

        return res.json({
            success: true,
            result,
        });

    } catch (error) {
        if (error instanceof multer.MulterError) { // multer error catch
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }

        if (axios.isAxiosError(error)) {
            console.log("========== SHAZAM ERROR ==========");
            console.log("Status:", error.response?.status);
            console.dir(error.response?.data, { depth: null });

            return res.status(502).json({
                success: false,
                error: "Music recognition failed.",
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

    }

});

export default router;
import express from "express";
import fs from "fs/promises";

import { downloadAudio } from "../services/downloader.js";
import { recognize } from "../services/recognition.js";
import { normalizeAudio } from "../services/normalizer.js";
import { normalize } from "path";

const router = express.Router();

router.post("/", async (req, res) => {

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            error: "Missing url"
        });
    }

    let audioPath = "";

    let normalized = "";

    try {

        audioPath = await downloadAudio(url);

        normalized = await normalizeAudio(audioPath);

        const result = await recognize(normalized);

        return res.json({
            success: true,
            result,
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            error: err instanceof Error
                ? err.message
                : "Unknown error"
        });

    } finally {

        if (audioPath) {
            await fs.unlink(audioPath).catch(() => {});
        }
        
        if (normalized) {
            await fs.unlink(normalized).catch(() => {});
        }

    }

});

export default router;
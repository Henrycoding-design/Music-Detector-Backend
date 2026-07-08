import express from "express";
import fs from "fs/promises";
import { downloadAudio } from "../services/downloader.js";
import { logMemorySnapshot } from "../services/memoryLogger.js";

const router = express.Router();

// A stable, permanent video to use as a fallback default
const DEFAULT_HEARTBEAT_URL = "https://www.youtube.com/watch?v=1kehqCLudyg";

// Load the secret token from environment variables
const HEARTBEAT_SECRET = process.env.HEARTBEAT_SECRET;

router.all("/keep-alive", async (req, res) => {
    // Only accept GET, HEAD, or POST
    if (req.method !== "GET" && req.method !== "POST" && req.method !== "HEAD") {
        return res.status(405).send("Method Not Allowed");
    }

    // 1. Extract the secret from query parameters
    const { token, url } = req.query;

    // 2. Validate the secret token
    if (!HEARTBEAT_SECRET || token !== HEARTBEAT_SECRET) {
        console.warn(`[heartbeat] Unauthorized access attempt blocked from IP: ${req.ip}`);
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

    // Dynamically grab the url from the query parameters, fallback to default if not provided
    const targetUrl = (url as string) || DEFAULT_HEARTBEAT_URL;

    console.log(`[heartbeat] Starting cookie refresh check with URL: ${targetUrl}`);
    let downloadedFilePath: string | null = null;

    try {
        // Trigger the download to force yt-dlp to read/write rolling cookies
        downloadedFilePath = await downloadAudio(targetUrl);
        
        console.log("[heartbeat] Cookie refresh successful!");
        return res.status(200).json({
            success: true,
            message: "Cookies successfully refreshed and rolled over.",
            testedUrl: targetUrl
        });
    } catch (error: any) {
        console.error("[heartbeat] Critical Failure! Cookies might be dead:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            testedUrl: targetUrl
        });
    } finally {
        // This block always executes, preventing disk accumulation on Render
        if (downloadedFilePath) {
            try {
                await fs.rm(downloadedFilePath, { force: true });
                console.log(`[heartbeat] Cleaned up temporary test file: ${downloadedFilePath}`);
            } catch (cleanupErr) {
                console.error("[heartbeat] Failed to delete temporary file:", cleanupErr);
            }
        }

        logMemorySnapshot("Heartbeat Memory Usage");
    }
});

export default router;
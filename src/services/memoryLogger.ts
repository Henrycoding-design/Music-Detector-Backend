
export interface MemoryStats {
    rss: string;       // Resident Set Size (Actual RAM occupied in RAM)
    heapTotal: string; // Total size of the allocated heap
    heapUsed: string;  // Memory actually used by V8 objects
    external: string;  // Memory used by C++ objects bound to JavaScript objects
}

/**
 * Formats bytes into a human-readable Megabyte string.
 */
function toMB(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Returns current memory statistics formatted in Megabytes.
 */
export function getMemoryStats(): MemoryStats {
    const memoryUsage = process.memoryUsage();

    return {
        rss: toMB(memoryUsage.rss),
        heapTotal: toMB(memoryUsage.heapTotal),
        heapUsed: toMB(memoryUsage.heapUsed),
        external: toMB(memoryUsage.external),
    };
}

/**
 * Logs a one-off snapshot of the current RAM usage to the console.
 * Perfect for placing in the final `finally` block of a request handler.
 * * @param tag - A label to identify where the log happened (e.g., "Recognize End")
 */
export function logMemorySnapshot(tag: string = "Snapshot"): void {
    const stats = getMemoryStats();
    console.log(
        `[Memory - ${tag}] RSS (Actual RAM): ${stats.rss} | Heap Used: ${stats.heapUsed} | Total Heap: ${stats.heapTotal}`
    );

    // Optional: Warn if approaching Render's free tier limit (512MB)
    const rssBytes = process.memoryUsage().rss;
    const freeTierLimit = 512 * 1024 * 1024; // 512 MB
    if (rssBytes > freeTierLimit * 0.8) {
        console.warn(`⚠️ WARNING: Process is utilizing >80% of Render Free Tier RAM limit!`);
    }
}
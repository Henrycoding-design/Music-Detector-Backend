import "dotenv/config"; // force dotenv config to run immediately

import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import cors from "cors";
import recognizeRouter from "./routes/recognize.js";
import urlRecognizeRouter from "./routes/urlRecognize.js";
import recordingRecognize from "./routes/recordingRecognize.js";
import heartbeat from "./routes/heartbeat.js";
import { ExecutableManager } from "./services/executableManager.js";

const app = express();

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (
    err instanceof multer.MulterError ||
    (err instanceof Error && err.message === "Only audio files are allowed.")
  ) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};

ExecutableManager.initialize();

app.use(cors());

app.use(express.json());

app.get("/", (_, res) => {
    res.send("Music Finder Backend");
});

app.use("/recognize", recognizeRouter);
app.use("/urlRecognize", urlRecognizeRouter);
app.use("/recordingRecognize", recordingRecognize);
app.use("/api", heartbeat);

app.use((_, res) => {
    res.status(404).json({
        success: false,
        error: "Route not found",
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
});
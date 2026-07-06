import "dotenv/config"; // force dotenv config to run immediately

import express from "express";
import cors from "cors";
import recognizeRouter from "./routes/recognize.js";
import urlRecognizeRouter from "./routes/urlRecognize.js";
import { ExecutableManager } from "./services/executableManager.js";

const app = express();

ExecutableManager.initialize();

app.use(cors());

app.use(express.json());

app.get("/", (_, res) => {
    res.send("Music Finder Backend");
});

app.use("/recognize", recognizeRouter);
app.use("/urlRecognize", urlRecognizeRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
});
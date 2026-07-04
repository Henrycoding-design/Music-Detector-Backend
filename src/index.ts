import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/regconize.js";

dotenv.config();

const app = express();

app.use(cors());

app.get("/", (_, res) => {
    res.send("Music Finder Backend");
});

app.use("/recognize", router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
});
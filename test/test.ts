import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const response = await axios.get(
    "https://shazam-core.p.rapidapi.com/v1/search/multi",
    {
        params: {
            search_type: "SONGS",
            query: "Metallica",
            offset: 0
        },
        headers: {
            "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
            "X-RapidAPI-Host": "shazam-core.p.rapidapi.com"
        }
    }
);

console.log(response.data);
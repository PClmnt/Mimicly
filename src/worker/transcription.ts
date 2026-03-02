import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";

dotenv.config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;


export async function transcribe(audioBlob: File) {
    const mistral = new Mistral({
        apiKey: MISTRAL_API_KEY,
    });


    const result = await mistral.audio.transcriptions.complete({
        model: "voxtral-mini-latest",
        file: audioBlob
    });
    console.log(result)
    return result.text
}


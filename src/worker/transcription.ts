import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";

dotenv.config();

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;


export async function transcribe(text: string) {
    const mistral = new Mistral({
        apiKey: MISTRAL_API_KEY,
    });


    const response = await mistral.chat.complete({
        model: "ministral-8b-2512",
        messages: [{
            role: "user",
            content: text,
        }]
    })


    return response.choices[0].message.content
}


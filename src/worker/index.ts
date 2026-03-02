import { Hono } from "hono";
import { transcribe } from "./transcription";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));


app.post("/api/transcribe", async (c) => {
    let file = await (await c.req.formData()).get("audio") as File

    console.log(file)
    const response = await transcribe(file)
    return c.json({ response });
});

export default app;

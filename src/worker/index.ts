import { Hono } from "hono";
import { transcribe } from "./transcription";
const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));


app.post("/api/transcribe", async (c) => {
    console.log(await c.body)
    const response = await transcribe("test");
    return c.json({ response });
});

export default app;

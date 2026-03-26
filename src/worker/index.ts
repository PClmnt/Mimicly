import { Hono } from "hono";
import { generateLesson, generateSceneImage, generateSpeech, scorePronunciation, transcribe, type WorkerSecrets } from "./ai";

type Bindings = Env & WorkerSecrets;

const app = new Hono<{ Bindings: Bindings }>();

function jsonError(c: { json: (body: { error: string }, status: number) => Response }, status: number, error: string) {
	return c.json({ error }, status);
}

function requiredString(value: string | File | null | undefined, label: string) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${label} is required.`);
	}

	return value.trim();
}

app.onError((error, c) => {
	console.error(error);
	return jsonError(c, 500, error.message || "Unexpected server error.");
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/transcribe", async (c) => {
	const formData = await c.req.formData();
	const audio = formData.get("audio");
	const transcriptionCode = typeof formData.get("transcriptionCode") === "string"
		? String(formData.get("transcriptionCode"))
		: "en";

	if (!(audio instanceof File)) {
		return jsonError(c, 400, "Audio file is required.");
	}

	const transcript = await transcribe(c.env, audio, transcriptionCode);
	return c.json({ transcript });
});

app.post("/api/lesson", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return jsonError(c, 400, "Invalid lesson request.");
	}

	const lesson = await generateLesson(c.env, {
		language: requiredString((body as Record<string, unknown>).language as string, "Language"),
		topic: requiredString((body as Record<string, unknown>).topic as string, "Topic"),
		difficulty: requiredString((body as Record<string, unknown>).difficulty as string, "Difficulty") as "easy" | "medium" | "hard",
		nativeLanguage: requiredString((body as Record<string, unknown>).nativeLanguage as string, "Native language"),
		phraseCount: typeof (body as Record<string, unknown>).phraseCount === "number"
			? Math.min(8, Math.max(3, Math.round((body as Record<string, unknown>).phraseCount as number)))
			: 5,
	});

	return c.json({ lesson });
});

app.post("/api/image", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return jsonError(c, 400, "Invalid image request.");
	}

	const imageUrl = await generateSceneImage(
		c.env,
		requiredString((body as Record<string, unknown>).phrase as string, "Phrase"),
		requiredString((body as Record<string, unknown>).translation as string, "Translation"),
		requiredString((body as Record<string, unknown>).language as string, "Language"),
	);

	return c.json({ imageUrl });
});

app.post("/api/speech", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return jsonError(c, 400, "Invalid speech request.");
	}

	const text = requiredString((body as Record<string, unknown>).text as string, "Text");
	const language = requiredString((body as Record<string, unknown>).language as string, "Language");
	const speed = typeof (body as Record<string, unknown>).speed === "number"
		? Math.min(1.1, Math.max(0.75, (body as Record<string, unknown>).speed as number))
		: 0.9;

	const audioBuffer = await generateSpeech(c.env, text, language, speed);
	return new Response(audioBuffer, {
		headers: {
			"Content-Type": "audio/mpeg",
			"Cache-Control": "private, max-age=3600",
		},
	});
});

app.post("/api/score", async (c) => {
	const formData = await c.req.formData();
	const audio = formData.get("audio");
	if (!(audio instanceof File)) {
		return jsonError(c, 400, "Audio file is required.");
	}

	const targetPhrase = requiredString(formData.get("targetPhrase"), "Target phrase");
	const language = requiredString(formData.get("language"), "Language");
	const transcriptionCode = requiredString(formData.get("transcriptionCode"), "Transcription code");

	const userTranscription = await transcribe(c.env, audio, transcriptionCode);
	const score = await scorePronunciation(c.env, {
		language,
		targetPhrase,
		userTranscription,
	});

	return c.json({ userTranscription, ...score });
});

export default app;

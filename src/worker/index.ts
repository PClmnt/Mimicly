import { Hono } from "hono";
import { generateLesson, generateSceneImage, generateSpeech, readMediaObject, scorePronunciation, transcribe, type WorkerBindings } from "./ai";
import { ensureSchema, loadPracticeState, recordPracticeResult, saveLessonForProfile } from "./persistence";
import type { Lesson } from "../react-app/types";

type Bindings = Env & WorkerBindings;

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

function maybeString(value: string | File | null | undefined) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

app.onError((error, c) => {
	console.error(error);
	return jsonError(c, 500, error.message || "Unexpected server error.");
});

app.get("/api/health", async (c) => {
	await ensureSchema(c.env);
	return c.json({ ok: true });
});

app.get("/api/profile/:profileId", async (c) => {
	const profileId = c.req.param("profileId");
	const state = await loadPracticeState(c.env, profileId);
	return c.json({ state });
});

app.get("/api/media/:kind/:key", async (c) => {
	const kind = c.req.param("kind");
	if (kind !== "image" && kind !== "speech") {
		return jsonError(c, 404, "Media not found.");
	}

	const object = await readMediaObject(c.env, kind, c.req.param("key"));
	if (!object) {
		return jsonError(c, 404, "Media not found.");
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Cache-Control", "public, max-age=31536000, immutable");
	return new Response(object.body, { headers });
});

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

	const request = body as Record<string, unknown>;
	const lesson = await generateLesson(c.env, {
		language: requiredString(request.language as string, "Language"),
		topic: requiredString(request.topic as string, "Topic"),
		difficulty: requiredString(request.difficulty as string, "Difficulty") as "easy" | "medium" | "hard",
		nativeLanguage: requiredString(request.nativeLanguage as string, "Native language"),
		phraseCount: typeof request.phraseCount === "number"
			? Math.min(8, Math.max(3, Math.round(request.phraseCount)))
			: 5,
	});

	await saveLessonForProfile(c.env, {
		profileId: requiredString(request.profileId as string, "Profile"),
		lesson,
	});

	return c.json({ lesson });
});

app.post("/api/image", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return jsonError(c, 400, "Invalid image request.");
	}

	const request = body as Record<string, unknown>;
	const imageUrl = await generateSceneImage(
		c.env,
		requiredString(request.phrase as string, "Phrase"),
		requiredString(request.translation as string, "Translation"),
		requiredString(request.language as string, "Language"),
	);

	return c.json({ imageUrl });
});

app.post("/api/speech", async (c) => {
	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return jsonError(c, 400, "Invalid speech request.");
	}

	const request = body as Record<string, unknown>;
	const text = requiredString(request.text as string, "Text");
	const language = requiredString(request.language as string, "Language");
	const speed = typeof request.speed === "number"
		? Math.min(1.1, Math.max(0.75, request.speed))
		: 0.9;

	const audio = await generateSpeech(c.env, text, language, speed);
	return new Response(audio.body, {
		headers: {
			"Content-Type": audio.contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
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

	const profileId = maybeString(formData.get("profileId"));
	const lessonId = maybeString(formData.get("lessonId"));
	const phraseId = maybeString(formData.get("phraseId"));
	const topic = maybeString(formData.get("topic"));
	const difficulty = maybeString(formData.get("difficulty"));
	const translation = maybeString(formData.get("translation"));
	const tip = maybeString(formData.get("tip"));

	if (profileId && lessonId && phraseId && topic && difficulty && translation && tip) {
		const lesson: Lesson = {
			id: lessonId,
			language,
			transcriptionCode,
			topic,
			difficulty: difficulty as "easy" | "medium" | "hard",
			nativeLanguage: "English",
			createdAt: new Date().toISOString(),
			title: "",
			intro: "",
			phrases: [{
				id: phraseId,
				text: targetPhrase,
				translation,
				romanization: maybeString(formData.get("romanization")) ?? undefined,
				difficulty: difficulty as "easy" | "medium" | "hard",
				tip,
			}],
		};

		await recordPracticeResult(c.env, {
			profileId,
			lesson,
			phrase: lesson.phrases[0],
			result: { userTranscription, ...score },
		});
	}

	return c.json({ userTranscription, ...score });
});

export default app;

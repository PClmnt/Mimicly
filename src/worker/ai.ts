import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { getLanguageOption, type Difficulty } from "../shared/languages";
import type { Lesson, ScoreResult } from "../react-app/types";

export interface WorkerBindings {
	LESSON_CACHE: KVNamespace;
	MEDIA_BUCKET: R2Bucket;
	MISTRAL_API_KEY: string;
	OPENAI_API_KEY: string;
	PRACTICE_DB: D1Database;
}

interface LessonInput {
	language: string;
	topic: string;
	difficulty: Difficulty;
	nativeLanguage: string;
	phraseCount: number;
}

interface LessonTemplate {
	difficulty: Difficulty;
	intro: string;
	language: string;
	nativeLanguage: string;
	phrases: Array<{
		difficulty: Difficulty;
		romanization?: string;
		text: string;
		tip: string;
		translation: string;
	}>;
	title: string;
	topic: string;
	transcriptionCode: string;
}

interface ScoreInput {
	language: string;
	targetPhrase: string;
	userTranscription: string;
}

interface TopicSuggestionInput {
	difficulty: Difficulty;
	language: string;
	nativeLanguage: string;
}

const IMAGE_MODEL = "gpt-image-1.5";
const IMAGE_QUALITY = "low";
const IMAGE_SIZE = "1024x1024";
const IMAGE_FORMAT = "webp";

function getMistral(env: WorkerBindings) {
	return new Mistral({ apiKey: env.MISTRAL_API_KEY });
}

function getOpenAI(env: WorkerBindings) {
	return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function parseJsonResponse(input: unknown) {
	if (typeof input !== "string") {
		return null;
	}

	try {
		return JSON.parse(input) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function stringOrFallback(value: unknown, fallback: string) {
	return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function difficultyOrFallback(value: unknown, fallback: Difficulty): Difficulty {
	if (value === "easy" || value === "medium" || value === "hard") {
		return value;
	}

	return fallback;
}

function arrayOfStrings(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatTopicTitle(value: string) {
	const lowercaseWords = new Set(["a", "an", "and", "at", "for", "from", "in", "of", "on", "the", "to", "with"]);

	return value
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.split(" ")
		.map((word, index) => {
			if (index > 0 && lowercaseWords.has(word)) {
				return word;
			}

			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ");
}

function uniqueTopics(values: string[]) {
	const seen = new Set<string>();
	const topics: string[] = [];

	for (const value of values) {
		const topic = formatTopicTitle(value);
		const key = topic.toLowerCase();
		if (!topic || seen.has(key)) {
			continue;
		}

		seen.add(key);
		topics.push(topic);
	}

	return topics;
}

function basicSimilarityScore(target: string, actual: string) {
	const normalizedTarget = normalizeComparisonText(target);
	const normalizedActual = normalizeComparisonText(actual);

	if (!normalizedTarget || !normalizedActual) {
		return 0;
	}

	const distance = levenshteinDistance(normalizedTarget, normalizedActual);
	const maxLength = Math.max(normalizedTarget.length, normalizedActual.length);
	return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function normalizeComparisonText(value: string) {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

function levenshteinDistance(left: string, right: string) {
	if (left === right) {
		return 0;
	}

	if (left.length === 0) {
		return right.length;
	}

	if (right.length === 0) {
		return left.length;
	}

	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	const current = new Array(right.length + 1).fill(0);

	for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
		current[0] = leftIndex + 1;

		for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
			const insertionCost = current[rightIndex] + 1;
			const deletionCost = previous[rightIndex + 1] + 1;
			const substitutionCost = previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1);
			current[rightIndex + 1] = Math.min(insertionCost, deletionCost, substitutionCost);
		}

		for (let copyIndex = 0; copyIndex < previous.length; copyIndex += 1) {
			previous[copyIndex] = current[copyIndex];
		}
	}

	return previous[right.length];
}

async function sha256(value: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildMediaUrl(kind: "image" | "speech", key: string) {
	return `/api/media/${kind}/${key}`;
}

function mapLessonTemplateToLesson(template: LessonTemplate): Lesson {
	return {
		id: crypto.randomUUID(),
		language: template.language,
		transcriptionCode: template.transcriptionCode,
		topic: template.topic,
		difficulty: template.difficulty,
		nativeLanguage: template.nativeLanguage,
		createdAt: new Date().toISOString(),
		title: template.title,
		intro: template.intro,
		phrases: template.phrases.map((phrase) => ({
			id: crypto.randomUUID(),
			text: phrase.text,
			translation: phrase.translation,
			romanization: phrase.romanization,
			difficulty: phrase.difficulty,
			tip: phrase.tip,
		})),
	};
}

function decodeBase64(base64: string) {
	const text = atob(base64);
	return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

export async function transcribe(env: WorkerBindings, audioBlob: File, transcriptionCode: string) {
	const mistral = getMistral(env);
	const result = await mistral.audio.transcriptions.complete({
		model: "voxtral-mini-latest",
		file: audioBlob,
		language: transcriptionCode,
	});

	return result.text?.trim() ?? "";
}

export async function generateSceneImage(env: WorkerBindings, phrase: string, translation: string, language: string) {
	const key = await sha256(JSON.stringify({
		phrase,
		translation,
		language,
		model: IMAGE_MODEL,
		quality: IMAGE_QUALITY,
		size: IMAGE_SIZE,
		format: IMAGE_FORMAT,
	}));
	const objectKey = `images/${key}.${IMAGE_FORMAT}`;
	const existing = await env.MEDIA_BUCKET.head(objectKey);
	if (!existing) {
		const openai = getOpenAI(env);
		const response = await openai.images.generate({
			model: IMAGE_MODEL,
			prompt: `Simple visual memory hook for a language flashcard. Show "${translation}" as a clear everyday scene with a light ${language} cultural feel. No text, no captions, no UI, no borders.`,
			n: 1,
			size: IMAGE_SIZE,
			quality: IMAGE_QUALITY,
			output_format: IMAGE_FORMAT,
			output_compression: 80,
		});

		const image = response.data?.[0]?.b64_json;
		if (!image) {
			throw new Error("Image generation returned no image.");
		}

		const bytes = decodeBase64(image);

		await env.MEDIA_BUCKET.put(objectKey, bytes, {
			httpMetadata: {
				contentType: "image/webp",
				cacheControl: "public, max-age=31536000, immutable",
			},
		});
	}

	return buildMediaUrl("image", key);
}

export async function generateSpeech(env: WorkerBindings, text: string, language: string, speed = 0.9) {
	const key = await sha256(JSON.stringify({ text, language, speed }));
	const objectKey = `speech/${key}.mp3`;
	const existing = await env.MEDIA_BUCKET.get(objectKey);
	if (existing) {
		return {
			body: existing.body,
			contentType: existing.httpMetadata?.contentType ?? "audio/mpeg",
		};
	}

	const openai = getOpenAI(env);
	const mp3 = await openai.audio.speech.create({
		model: "gpt-4o-mini-tts",
		voice: "nova",
		input: text,
		instructions: `Speak clearly in ${language}. This audio is for pronunciation practice, so keep the pacing slightly slower than normal conversation while preserving natural rhythm.`,
		speed,
	});

	const buffer = new Uint8Array(await mp3.arrayBuffer());
	await env.MEDIA_BUCKET.put(objectKey, buffer, {
		httpMetadata: {
			contentType: "audio/mpeg",
			cacheControl: "public, max-age=31536000, immutable",
		},
	});

	return {
		body: buffer,
		contentType: "audio/mpeg",
	};
}

export async function readMediaObject(env: WorkerBindings, kind: "image" | "speech", key: string) {
	const objectKey = kind === "image" ? `images/${key}.${IMAGE_FORMAT}` : `speech/${key}.mp3`;
	return env.MEDIA_BUCKET.get(objectKey);
}

export async function scorePronunciation(env: WorkerBindings, input: ScoreInput): Promise<Omit<ScoreResult, "userTranscription">> {
	const mistral = getMistral(env);
	const fallbackScore = basicSimilarityScore(input.targetPhrase, input.userTranscription);

	const result = await mistral.chat.complete({
		model: "mistral-small-latest",
		messages: [
			{
				role: "system",
				content: `You are a strict but encouraging pronunciation coach for ${input.language}.
Return a JSON object with:
- score: number 0-100
- feedback: one short sentence about how close the learner was
- differences: array of concrete sound, word, or character mismatches
- perfect: boolean
- nextStep: one short coaching instruction for the next repetition

Ignore punctuation and whitespace. Reward intelligibility over spelling, but keep the score honest.`,
			},
			{
				role: "user",
				content: `Target phrase: "${input.targetPhrase}"\nLearner transcription: "${input.userTranscription}"`,
			},
		],
		responseFormat: { type: "json_object" },
	});

	const parsed = parseJsonResponse(result.choices?.[0]?.message?.content);
	if (!parsed) {
		return {
			score: fallbackScore,
			feedback: fallbackScore >= 90 ? "That was very close. Keep the rhythm steady." : "You are in range, but a few sounds still need cleanup.",
			differences: [],
			perfect: fallbackScore >= 98,
			nextStep: "Listen once more and focus on the first sound that changed.",
		};
	}

	const score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : fallbackScore;

	return {
		score,
		feedback: stringOrFallback(parsed.feedback, "Solid attempt. Clean up the mismatched sounds and repeat it once more."),
		differences: arrayOfStrings(parsed.differences),
		perfect: parsed.perfect === true || score >= 99,
		nextStep: stringOrFallback(parsed.nextStep, "Repeat the phrase again with slower pacing and stronger stress control."),
	};
}

export async function generateTopicSuggestions(env: WorkerBindings, input: TopicSuggestionInput) {
	const cacheKey = await sha256(JSON.stringify(input));
	const cachedTopics = await env.LESSON_CACHE.get(`topics:${cacheKey}`, "json") as string[] | null;
	if (cachedTopics?.length) {
		return uniqueTopics(cachedTopics).slice(0, 6);
	}

	const mistral = getMistral(env);
	const result = await mistral.chat.complete({
		model: "mistral-small-latest",
		messages: [
			{
				role: "system",
				content: `Suggest practical spoken-language lesson topics for ${input.language}.
The learner's native language is ${input.nativeLanguage}.
Difficulty: ${input.difficulty}.

Return a JSON object with:
- topics: array of exactly 6 concise topic strings

Each topic should be specific, useful for real conversation, and 2-5 words long.`,
			},
			{
				role: "user",
				content: "Suggest topics now.",
			},
		],
		responseFormat: { type: "json_object" },
	});

	const parsed = parseJsonResponse(result.choices?.[0]?.message?.content);
	const topics = uniqueTopics(arrayOfStrings(parsed?.topics))
		.filter((topic) => topic.length <= 48)
		.slice(0, 6);

	if (topics.length === 0) {
		throw new Error("Topic suggestions failed. Try again.");
	}

	await env.LESSON_CACHE.put(`topics:${cacheKey}`, JSON.stringify(topics), {
		expirationTtl: 60 * 60 * 24 * 7,
	});

	return topics;
}

export async function generateLesson(env: WorkerBindings, input: LessonInput): Promise<Lesson> {
	const language = getLanguageOption(input.language);
	const cacheKey = await sha256(JSON.stringify(input));
	const cachedTemplate = await env.LESSON_CACHE.get(`lesson:${cacheKey}`, "json") as LessonTemplate | null;
	if (cachedTemplate) {
		return mapLessonTemplateToLesson(cachedTemplate);
	}

	const mistral = getMistral(env);
	const result = await mistral.chat.complete({
		model: "mistral-small-latest",
		messages: [
			{
				role: "system",
				content: `You create compact spoken-language practice sets.
Generate exactly ${input.phraseCount} phrases for ${input.language} about "${input.topic}" at ${input.difficulty} difficulty.
The learner's native language is ${input.nativeLanguage}.

Return a JSON object with:
- title: short lesson title
- intro: one sentence about what this practice set covers
- phrases: array of exactly ${input.phraseCount} objects, each with:
  - text: phrase in ${input.language}
  - translation: natural ${input.nativeLanguage} translation
  - romanization: only if useful for this language
  - difficulty: easy, medium, or hard
  - tip: one short pronunciation or rhythm cue`,
			},
			{
				role: "user",
				content: "Build the practice set now.",
			},
		],
		responseFormat: { type: "json_object" },
	});

	const parsed = parseJsonResponse(result.choices?.[0]?.message?.content);
	const rawPhrases = Array.isArray(parsed?.phrases) ? parsed.phrases : [];

	const template: LessonTemplate = {
		title: stringOrFallback(parsed?.title, `${input.language} practice`),
		intro: stringOrFallback(parsed?.intro, `Practice short ${input.language} phrases about ${input.topic}.`),
		language: input.language,
		nativeLanguage: input.nativeLanguage,
		topic: input.topic,
		difficulty: input.difficulty,
		transcriptionCode: language.transcriptionCode,
		phrases: rawPhrases.slice(0, input.phraseCount).map((rawPhrase, index) => {
			const phrase = rawPhrase as Record<string, unknown>;
			const romanization = language.romanizationLabel ? stringOrFallback(phrase.romanization, "") : "";

			return {
				text: stringOrFallback(phrase.text, `Phrase ${index + 1}`),
				translation: stringOrFallback(phrase.translation, ""),
				romanization: romanization || undefined,
				difficulty: difficultyOrFallback(phrase.difficulty, input.difficulty),
				tip: stringOrFallback(phrase.tip, "Keep the rhythm natural and avoid rushing the middle sounds."),
			};
		}).filter((phrase) => phrase.text && phrase.translation),
	};

	if (template.phrases.length === 0) {
		throw new Error("Lesson generation failed. Try a different topic.");
	}

	await env.LESSON_CACHE.put(`lesson:${cacheKey}`, JSON.stringify(template), {
		expirationTtl: 60 * 60 * 24 * 7,
	});

	return mapLessonTemplateToLesson(template);
}

import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { getLanguageOption, type Difficulty } from "../shared/languages";
import type { Lesson, ScoreResult } from "../react-app/types";

export interface WorkerSecrets {
	MISTRAL_API_KEY: string;
	OPENAI_API_KEY: string;
}

interface LessonInput {
	language: string;
	topic: string;
	difficulty: Difficulty;
	nativeLanguage: string;
	phraseCount: number;
}

interface ScoreInput {
	language: string;
	targetPhrase: string;
	userTranscription: string;
}

const lessonCache = createMemoryCache<Lesson>(1000 * 60 * 60);
const speechCache = createMemoryCache<Uint8Array>(1000 * 60 * 60 * 4);
const imageCache = createMemoryCache<string | null>(1000 * 60 * 60 * 12);

function createMemoryCache<T>(ttlMs: number) {
	const store = new Map<string, { expiresAt: number; value: T }>();

	return {
		get(key: string) {
			const cached = store.get(key);
			if (!cached) {
				return null;
			}

			if (cached.expiresAt <= Date.now()) {
				store.delete(key);
				return null;
			}

			return cached.value;
		},
		set(key: string, value: T) {
			store.set(key, {
				expiresAt: Date.now() + ttlMs,
				value,
			});
		},
	};
}

function getMistral(env: WorkerSecrets) {
	return new Mistral({ apiKey: env.MISTRAL_API_KEY });
}

function getOpenAI(env: WorkerSecrets) {
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

export async function transcribe(env: WorkerSecrets, audioBlob: File, transcriptionCode: string) {
	const mistral = getMistral(env);
	const result = await mistral.audio.transcriptions.complete({
		model: "voxtral-mini-latest",
		file: audioBlob,
		language: transcriptionCode,
	});

	return result.text?.trim() ?? "";
}

export async function generateSceneImage(env: WorkerSecrets, phrase: string, translation: string, language: string) {
	const cacheKey = JSON.stringify({ phrase, translation, language });
	const cached = imageCache.get(cacheKey);
	if (cached !== null) {
		return cached;
	}

	const openai = getOpenAI(env);
	const response = await openai.images.generate({
		model: "gpt-image-1-mini",
		prompt: `Create a clean, warm illustration for a language-learning flashcard. Show the meaning of "${translation}" while preserving the feel of ${language}. No text, no captions, no UI, no borders.`,
		n: 1,
		size: "1024x1024",
	});

	const image = response.data?.[0];
	const imageUrl = image?.url ?? (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : null);
	imageCache.set(cacheKey, imageUrl);
	return imageUrl;
}

export async function generateSpeech(env: WorkerSecrets, text: string, language: string, speed = 0.9) {
	const cacheKey = JSON.stringify({ text, language, speed });
	const cached = speechCache.get(cacheKey);
	if (cached) {
		return cached;
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
	speechCache.set(cacheKey, buffer);
	return buffer;
}

export async function scorePronunciation(env: WorkerSecrets, input: ScoreInput): Promise<Omit<ScoreResult, "userTranscription">> {
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

export async function generateLesson(env: WorkerSecrets, input: LessonInput): Promise<Lesson> {
	const language = getLanguageOption(input.language);
	const cacheKey = JSON.stringify(input);
	const cached = lessonCache.get(cacheKey);
	if (cached) {
		return cached;
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
				content: `Build the practice set now.`,
			},
		],
		responseFormat: { type: "json_object" },
	});

	const parsed = parseJsonResponse(result.choices?.[0]?.message?.content);
	const rawPhrases = Array.isArray(parsed?.phrases) ? parsed.phrases : [];

	const phrases = rawPhrases.slice(0, input.phraseCount).map((rawPhrase, index) => {
		const phrase = rawPhrase as Record<string, unknown>;
		const romanization = language.romanizationLabel
			? stringOrFallback(phrase.romanization, "")
			: "";

		return {
			id: crypto.randomUUID(),
			text: stringOrFallback(phrase.text, `Phrase ${index + 1}`),
			translation: stringOrFallback(phrase.translation, ""),
			romanization: romanization || undefined,
			difficulty: difficultyOrFallback(phrase.difficulty, input.difficulty),
			tip: stringOrFallback(phrase.tip, "Keep the rhythm natural and avoid rushing the middle sounds."),
		};
	}).filter((phrase) => phrase.text && phrase.translation);

	if (phrases.length === 0) {
		throw new Error("Lesson generation failed. Try a different topic.");
	}

	const lesson: Lesson = {
		id: crypto.randomUUID(),
		language: input.language,
		transcriptionCode: language.transcriptionCode,
		topic: input.topic,
		difficulty: input.difficulty,
		nativeLanguage: input.nativeLanguage,
		createdAt: new Date().toISOString(),
		title: stringOrFallback(parsed?.title, `${input.language} practice`),
		intro: stringOrFallback(parsed?.intro, `Practice short ${input.language} phrases about ${input.topic}.`),
		phrases,
	};

	lessonCache.set(cacheKey, lesson);
	return lesson;
}

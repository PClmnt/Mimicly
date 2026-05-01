import type { Lesson, LessonRequest, Phrase, PracticeState, ScoreResult } from "./types";

interface SceneImageResponse {
	imageUrl: string | null;
}

interface LessonResponse {
	lesson: Lesson;
}

interface PracticeStateResponse {
	state: PracticeState | null;
}

interface TopicSuggestionsResponse {
	topics: string[];
}

interface ScoreRequestInput {
	audio: Blob;
	difficulty: string;
	language: string;
	lessonId: string;
	phrase: Phrase;
	profileId: string;
	targetPhrase: string;
	topic: string;
	transcriptionCode: string;
}

function extractErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong.";
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let message = `Request failed with ${response.status}`;
		try {
			const data = await response.json() as { error?: string };
			if (data.error) {
				message = data.error;
			}
		} catch {
			// Ignore JSON parsing failure for error bodies.
		}
		throw new Error(message);
	}

	return response.json() as Promise<T>;
}

export async function requestLesson(payload: LessonRequest) {
	try {
		const response = await fetch("/api/lesson", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		const data = await parseJsonOrThrow<LessonResponse>(response);
		return data.lesson;
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

export async function requestProfileState(profileId: string) {
	try {
		const response = await fetch(`/api/profile/${encodeURIComponent(profileId)}`);
		if (response.status === 404) {
			return null;
		}

		const data = await parseJsonOrThrow<PracticeStateResponse>(response);
		return data.state;
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

export async function requestSpeech(text: string, language: string, speed = 0.9) {
	try {
		const response = await fetch("/api/speech", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, language, speed }),
		});

		if (!response.ok) {
			throw new Error(`Speech request failed with ${response.status}`);
		}

		return response.blob();
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

export async function requestSceneImage(phrase: string, translation: string, language: string) {
	try {
		const response = await fetch("/api/image", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ phrase, translation, language }),
		});

		const data = await parseJsonOrThrow<SceneImageResponse>(response);
		return data.imageUrl;
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

export async function requestTopicIdeas(language: string, difficulty: string, nativeLanguage: string) {
	try {
		const response = await fetch("/api/topics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ language, difficulty, nativeLanguage }),
		});

		const data = await parseJsonOrThrow<TopicSuggestionsResponse>(response);
		return data.topics;
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

export async function scorePhrase(input: ScoreRequestInput) {
	try {
		const formData = new FormData();
		formData.append("audio", input.audio, "attempt.webm");
		formData.append("targetPhrase", input.targetPhrase);
		formData.append("language", input.language);
		formData.append("transcriptionCode", input.transcriptionCode);
		formData.append("profileId", input.profileId);
		formData.append("lessonId", input.lessonId);
		formData.append("topic", input.topic);
		formData.append("difficulty", input.difficulty);
		formData.append("phraseId", input.phrase.id);
		formData.append("translation", input.phrase.translation);
		formData.append("tip", input.phrase.tip);
		if (input.phrase.romanization) {
			formData.append("romanization", input.phrase.romanization);
		}

		const response = await fetch("/api/score", {
			method: "POST",
			body: formData,
		});

		return parseJsonOrThrow<ScoreResult>(response);
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

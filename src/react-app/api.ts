import type { Lesson, LessonRequest, ScoreResult } from "./types";

interface SceneImageResponse {
	imageUrl: string | null;
}

interface LessonResponse {
	lesson: Lesson;
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

export async function scorePhrase(
	audio: Blob,
	targetPhrase: string,
	language: string,
	transcriptionCode: string,
) {
	try {
		const formData = new FormData();
		formData.append("audio", audio, "attempt.webm");
		formData.append("targetPhrase", targetPhrase);
		formData.append("language", language);
		formData.append("transcriptionCode", transcriptionCode);

		const response = await fetch("/api/score", {
			method: "POST",
			body: formData,
		});

		return parseJsonOrThrow<ScoreResult>(response);
	} catch (error) {
		throw new Error(extractErrorMessage(error));
	}
}

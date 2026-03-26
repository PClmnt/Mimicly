import { DEFAULT_PRACTICE_STATE } from "./constants";
import { getLanguageOption } from "../shared/languages";
import type {
	Lesson,
	Phrase,
	PracticeAttempt,
	PracticeState,
	PracticeStats,
	SavedPhrase,
	ScoreResult,
} from "./types";

const STORAGE_KEY = "mimicly.practice-state.v2";
const MAX_ATTEMPTS = 60;
const MAX_RECENT_LESSONS = 4;
const WEAK_SCORE_THRESHOLD = 90;
const MASTERED_SUCCESS_COUNT = 2;
const MASTERED_SCORE = 95;

function canUseStorage() {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPracticeState(): PracticeState {
	if (!canUseStorage()) {
		return DEFAULT_PRACTICE_STATE;
	}

	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return DEFAULT_PRACTICE_STATE;
	}

	try {
		const parsed = JSON.parse(raw) as PracticeState;
		return {
			...DEFAULT_PRACTICE_STATE,
			...parsed,
			preferences: {
				...DEFAULT_PRACTICE_STATE.preferences,
				...parsed.preferences,
			},
			savedPhrases: parsed.savedPhrases ?? [],
			attempts: parsed.attempts ?? [],
			recentLessons: parsed.recentLessons ?? [],
			lastLesson: parsed.lastLesson ?? null,
		};
	} catch {
		return DEFAULT_PRACTICE_STATE;
	}
}

export function savePracticeState(state: PracticeState) {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function rememberLesson(state: PracticeState, lesson: Lesson): PracticeState {
	return {
		...state,
		lastLesson: lesson,
		recentLessons: [lesson, ...state.recentLessons.filter((item) => item.id !== lesson.id)].slice(0, MAX_RECENT_LESSONS),
	};
}

export function buildPracticeStats(state: PracticeState): PracticeStats {
	const totalAttempts = state.attempts.length;
	const averageScore = totalAttempts === 0
		? 0
		: Math.round(state.attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts);

	const recentPracticeCount = state.attempts.filter((attempt) => {
		const age = Date.now() - new Date(attempt.createdAt).getTime();
		return age < 1000 * 60 * 60 * 24 * 7;
	}).length;

	return {
		totalAttempts,
		averageScore,
		weakPhraseCount: state.savedPhrases.length,
		recentPracticeCount,
	};
}

export function createReviewLesson(savedPhrases: SavedPhrase[]): Lesson | null {
	if (savedPhrases.length === 0) {
		return null;
	}

	const lessonPhrases = savedPhrases.map((savedPhrase) => savedPhrase.phrase);
	const firstPhrase = savedPhrases[0];

	return {
		id: crypto.randomUUID(),
		language: firstPhrase.language,
		transcriptionCode: getLanguageOption(firstPhrase.language).transcriptionCode,
		topic: "Weak phrase review",
		difficulty: firstPhrase.difficulty,
		nativeLanguage: "English",
		createdAt: new Date().toISOString(),
		title: `${firstPhrase.language} review`,
		intro: "Revisit the phrases you missed and clear them from your queue with clean repetitions.",
		phrases: lessonPhrases,
	};
}

export function recordPracticeAttempt(
	state: PracticeState,
	lesson: Lesson,
	phrase: Phrase,
	result: ScoreResult,
): PracticeState {
	const attempt: PracticeAttempt = {
		id: crypto.randomUUID(),
		lessonId: lesson.id,
		phraseId: phrase.id,
		phraseText: phrase.text,
		language: lesson.language,
		score: result.score,
		userTranscription: result.userTranscription,
		feedback: result.feedback,
		createdAt: new Date().toISOString(),
	};

	const nextSavedPhrases = upsertSavedPhrase(state.savedPhrases, lesson, phrase, result);

	return {
		...state,
		attempts: [attempt, ...state.attempts].slice(0, MAX_ATTEMPTS),
		savedPhrases: nextSavedPhrases,
	};
}

function upsertSavedPhrase(
	savedPhrases: SavedPhrase[],
	lesson: Lesson,
	phrase: Phrase,
	result: ScoreResult,
) {
	const existing = savedPhrases.find((savedPhrase) => savedPhrase.phrase.id === phrase.id);

	if (result.score >= WEAK_SCORE_THRESHOLD) {
		if (!existing) {
			return savedPhrases;
		}

		const nextSuccessCount = existing.successCount + 1;
		if (nextSuccessCount >= MASTERED_SUCCESS_COUNT && result.score >= MASTERED_SCORE) {
			return savedPhrases.filter((savedPhrase) => savedPhrase.phrase.id !== phrase.id);
		}

		return savedPhrases.map((savedPhrase) => {
			if (savedPhrase.phrase.id !== phrase.id) {
				return savedPhrase;
			}

			return {
				...savedPhrase,
				lastScore: result.score,
				lastPracticedAt: new Date().toISOString(),
				reviewCount: savedPhrase.reviewCount + 1,
				successCount: nextSuccessCount,
			};
		});
	}

	if (existing) {
		return savedPhrases.map((savedPhrase) => {
			if (savedPhrase.phrase.id !== phrase.id) {
				return savedPhrase;
			}

			return {
				...savedPhrase,
				lastScore: result.score,
				lastPracticedAt: new Date().toISOString(),
				reviewCount: savedPhrase.reviewCount + 1,
				successCount: 0,
			};
		});
	}

	return [{
		id: crypto.randomUUID(),
		language: lesson.language,
		topic: lesson.topic,
		difficulty: phrase.difficulty,
		phrase,
		lastScore: result.score,
		lastPracticedAt: new Date().toISOString(),
		reviewCount: 1,
		successCount: 0,
	}, ...savedPhrases];
}

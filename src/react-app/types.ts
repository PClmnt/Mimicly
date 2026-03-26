import type { Difficulty } from "../shared/languages";

export interface Phrase {
	id: string;
	text: string;
	translation: string;
	romanization?: string;
	difficulty: Difficulty;
	tip: string;
}

export interface Lesson {
	id: string;
	language: string;
	transcriptionCode: string;
	topic: string;
	difficulty: Difficulty;
	nativeLanguage: string;
	createdAt: string;
	title: string;
	intro: string;
	phrases: Phrase[];
}

export interface ScoreResult {
	userTranscription: string;
	score: number;
	feedback: string;
	differences: string[];
	perfect: boolean;
	nextStep: string;
}

export interface PracticeAttempt {
	id: string;
	lessonId: string;
	phraseId: string;
	phraseText: string;
	language: string;
	score: number;
	userTranscription: string;
	feedback: string;
	createdAt: string;
}

export interface SavedPhrase {
	id: string;
	language: string;
	topic: string;
	difficulty: Difficulty;
	phrase: Phrase;
	lastScore: number;
	lastPracticedAt: string;
	reviewCount: number;
	successCount: number;
}

export interface Preferences {
	language: string;
	topic: string;
	difficulty: Difficulty;
	nativeLanguage: string;
}

export interface PracticeState {
	preferences: Preferences;
	savedPhrases: SavedPhrase[];
	attempts: PracticeAttempt[];
	recentLessons: Lesson[];
	lastLesson: Lesson | null;
}

export interface PracticeStats {
	totalAttempts: number;
	averageScore: number;
	weakPhraseCount: number;
	recentPracticeCount: number;
}

export interface LessonRequest {
	profileId: string;
	language: string;
	topic: string;
	difficulty: Difficulty;
	nativeLanguage: string;
	phraseCount: number;
}

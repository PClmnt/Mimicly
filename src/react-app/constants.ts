import { DIFFICULTY_OPTIONS, LANGUAGES, TOPIC_SUGGESTIONS } from "../shared/languages";
import type { PracticeState } from "./types";

export { DIFFICULTY_OPTIONS, LANGUAGES, TOPIC_SUGGESTIONS };

export const DEFAULT_PHRASE_COUNT = 5;
export const REVIEW_SESSION_SIZE = 6;

export const DEFAULT_PRACTICE_STATE: PracticeState = {
	preferences: {
		language: LANGUAGES[2].value,
		topic: TOPIC_SUGGESTIONS[0],
		difficulty: "easy",
		nativeLanguage: "English",
	},
	savedPhrases: [],
	attempts: [],
	recentLessons: [],
	lastLesson: null,
};

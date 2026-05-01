export type Difficulty = "easy" | "medium" | "hard";

export interface LanguageOption {
	value: string;
	label: string;
	locale: string;
	transcriptionCode: string;
	romanizationLabel?: string;
}

export const LANGUAGES: LanguageOption[] = [
	{
		value: "Chinese",
		label: "Chinese",
		locale: "zh-CN",
		transcriptionCode: "zh",
		romanizationLabel: "Pinyin",
	},
	{
		value: "Japanese",
		label: "Japanese",
		locale: "ja-JP",
		transcriptionCode: "ja",
		romanizationLabel: "Romaji",
	},
	{
		value: "Spanish",
		label: "Spanish",
		locale: "es-ES",
		transcriptionCode: "es",
	},
	{
		value: "French",
		label: "French",
		locale: "fr-FR",
		transcriptionCode: "fr",
	},
	{
		value: "Korean",
		label: "Korean",
		locale: "ko-KR",
		transcriptionCode: "ko",
		romanizationLabel: "Romanization",
	},
	{
		value: "German",
		label: "German",
		locale: "de-DE",
		transcriptionCode: "de",
	},
	{
		value: "Italian",
		label: "Italian",
		locale: "it-IT",
		transcriptionCode: "it",
	},
	{
		value: "Portuguese",
		label: "Portuguese",
		locale: "pt-PT",
		transcriptionCode: "pt",
	},
];

export const TOPIC_SUGGESTIONS = [
	"Introducing yourself",
	"Ordering at a cafe",
	"Asking for directions",
	"Checking into a hotel",
	"Meeting coworkers",
	"Shopping at a market",
	"At the airport",
	"Talking about your family",
];

const TOPIC_SUGGESTIONS_BY_DIFFICULTY: Record<Difficulty, string[]> = {
	easy: [
		"Introducing yourself",
		"Ordering at a cafe",
		"Asking for directions",
		"Shopping at a market",
		"Talking about your family",
		"Checking into a hotel",
	],
	medium: [
		"Ordering at a restaurant",
		"Asking for directions",
		"Checking into a hotel",
		"Small talk with coworkers",
		"Buying train tickets",
		"Describing symptoms",
	],
	hard: [
		"Explaining a work problem",
		"Handling a missed connection",
		"Negotiating a return",
		"Discussing weekend plans",
		"Describing a news story",
		"Making a complaint politely",
	],
};

const TOPIC_SUGGESTIONS_BY_LANGUAGE: Partial<Record<string, Partial<Record<Difficulty, string[]>>>> = {
	Chinese: {
		easy: [
			"Ordering bubble tea",
			"Buying fruit at a market",
			"Taking a taxi",
			"Introducing your name",
			"Asking for the bathroom",
			"Paying with a phone",
		],
		medium: [
			"Ordering hotpot",
			"Asking for directions",
			"Checking into a hotel",
			"Small talk with coworkers",
			"Buying train tickets",
			"Describing symptoms",
		],
		hard: [
			"Discussing apartment issues",
			"Explaining a delivery problem",
			"Negotiating at a market",
			"Making plans for a holiday",
			"Discussing work deadlines",
			"Handling a bank appointment",
		],
	},
	Japanese: {
		medium: [
			"Ordering ramen",
			"Asking train platform questions",
			"Checking into a ryokan",
			"Small talk after work",
			"Shopping at a convenience store",
			"Making polite requests",
		],
	},
	Spanish: {
		medium: [
			"Ordering tapas",
			"Asking for directions",
			"Booking a table",
			"Meeting coworkers",
			"Buying train tickets",
			"Talking about weekend plans",
		],
	},
	French: {
		medium: [
			"Ordering at a bakery",
			"Asking metro directions",
			"Checking into a hotel",
			"Making small talk",
			"Buying train tickets",
			"Explaining food preferences",
		],
	},
	Korean: {
		medium: [
			"Ordering barbecue",
			"Asking subway directions",
			"Checking into a hotel",
			"Meeting coworkers",
			"Shopping for skincare",
			"Making weekend plans",
		],
	},
	German: {
		medium: [
			"Ordering at a bakery",
			"Asking tram directions",
			"Checking into a hotel",
			"Talking with coworkers",
			"Buying train tickets",
			"Handling an appointment",
		],
	},
	Italian: {
		medium: [
			"Ordering coffee",
			"Asking for directions",
			"Checking into a hotel",
			"Shopping at a market",
			"Buying train tickets",
			"Talking about family",
		],
	},
	Portuguese: {
		medium: [
			"Ordering lunch",
			"Asking for directions",
			"Checking into a hotel",
			"Meeting coworkers",
			"Buying train tickets",
			"Talking about the weather",
		],
	},
};

export const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string; hint: string }> = [
	{ value: "easy", label: "Easy", hint: "Short, high-frequency phrases." },
	{ value: "medium", label: "Medium", hint: "Natural phrases with some variety." },
	{ value: "hard", label: "Hard", hint: "Longer phrases with trickier sounds." },
];

export function getLanguageOption(language: string): LanguageOption {
	return LANGUAGES.find((option) => option.value === language) ?? LANGUAGES[0];
}

export function getTopicSuggestions(language: string, difficulty: Difficulty) {
	const languageTopics = TOPIC_SUGGESTIONS_BY_LANGUAGE[language]?.[difficulty] ?? [];
	const difficultyTopics = TOPIC_SUGGESTIONS_BY_DIFFICULTY[difficulty];
	return Array.from(new Set([...languageTopics, ...difficultyTopics])).slice(0, 8);
}

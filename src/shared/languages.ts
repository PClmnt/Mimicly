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

export const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string; hint: string }> = [
	{ value: "easy", label: "Easy", hint: "Short, high-frequency phrases." },
	{ value: "medium", label: "Medium", hint: "Natural phrases with some variety." },
	{ value: "hard", label: "Hard", hint: "Longer phrases with trickier sounds." },
];

export function getLanguageOption(language: string): LanguageOption {
	return LANGUAGES.find((option) => option.value === language) ?? LANGUAGES[0];
}

import type { Difficulty } from "../shared/languages";
import type { Lesson, Phrase, PracticeAttempt, PracticeState, SavedPhrase, ScoreResult } from "../react-app/types";
import type { WorkerBindings } from "./ai";

const DEFAULT_PREFERENCES = {
	language: "Spanish",
	topic: "Introducing yourself",
	difficulty: "easy" as Difficulty,
	nativeLanguage: "English",
};

const MAX_ATTEMPTS = 60;
const MAX_RECENT_LESSONS = 4;
const WEAK_SCORE_THRESHOLD = 90;
const MASTERED_SUCCESS_COUNT = 2;
const MASTERED_SCORE = 95;

const SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS profiles (
	id TEXT PRIMARY KEY,
	preferred_language TEXT NOT NULL,
	preferred_topic TEXT NOT NULL,
	preferred_difficulty TEXT NOT NULL,
	native_language TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);`,

	`CREATE TABLE IF NOT EXISTS lessons (
	id TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	language TEXT NOT NULL,
	transcription_code TEXT NOT NULL,
	topic TEXT NOT NULL,
	difficulty TEXT NOT NULL,
	native_language TEXT NOT NULL,
	title TEXT NOT NULL,
	intro TEXT NOT NULL,
	created_at TEXT NOT NULL
);`,

	`CREATE TABLE IF NOT EXISTS lesson_phrases (
	id TEXT PRIMARY KEY,
	lesson_id TEXT NOT NULL,
	text_value TEXT NOT NULL,
	translation TEXT NOT NULL,
	romanization TEXT,
	difficulty TEXT NOT NULL,
	tip TEXT NOT NULL,
	sort_order INTEGER NOT NULL
);`,

	`CREATE TABLE IF NOT EXISTS practice_attempts (
	id TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	lesson_id TEXT NOT NULL,
	phrase_id TEXT NOT NULL,
	phrase_text TEXT NOT NULL,
	language TEXT NOT NULL,
	score INTEGER NOT NULL,
	user_transcription TEXT NOT NULL,
	feedback TEXT NOT NULL,
	created_at TEXT NOT NULL
);`,

	`CREATE TABLE IF NOT EXISTS review_phrases (
	id TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	language TEXT NOT NULL,
	topic TEXT NOT NULL,
	difficulty TEXT NOT NULL,
	phrase_id TEXT NOT NULL,
	phrase_text TEXT NOT NULL,
	translation TEXT NOT NULL,
	romanization TEXT,
	tip TEXT NOT NULL,
	last_score INTEGER NOT NULL,
	last_practiced_at TEXT NOT NULL,
	review_count INTEGER NOT NULL,
	success_count INTEGER NOT NULL,
	UNIQUE(profile_id, language, phrase_text)
);`,
	"CREATE INDEX IF NOT EXISTS idx_lessons_profile_created_at ON lessons(profile_id, created_at DESC);",
	"CREATE INDEX IF NOT EXISTS idx_attempts_profile_created_at ON practice_attempts(profile_id, created_at DESC);",
	"CREATE INDEX IF NOT EXISTS idx_review_profile_score ON review_phrases(profile_id, last_score ASC, last_practiced_at DESC);",
];

let schemaPromise: Promise<void> | null = null;

interface ProfileRow {
	id: string;
	preferred_language: string;
	preferred_topic: string;
	preferred_difficulty: string;
	native_language: string;
}

interface LessonRow {
	id: string;
	language: string;
	transcription_code: string;
	topic: string;
	difficulty: string;
	native_language: string;
	title: string;
	intro: string;
	created_at: string;
}

interface LessonPhraseRow {
	id: string;
	lesson_id: string;
	text_value: string;
	translation: string;
	romanization: string | null;
	difficulty: string;
	tip: string;
	sort_order: number;
}

interface AttemptRow {
	id: string;
	lesson_id: string;
	phrase_id: string;
	phrase_text: string;
	language: string;
	score: number;
	user_transcription: string;
	feedback: string;
	created_at: string;
}

interface ReviewRow {
	id: string;
	language: string;
	topic: string;
	difficulty: string;
	phrase_id: string;
	phrase_text: string;
	translation: string;
	romanization: string | null;
	tip: string;
	last_score: number;
	last_practiced_at: string;
	review_count: number;
	success_count: number;
}

interface RecordAttemptInput {
	profileId: string;
	lesson: Lesson;
	phrase: Phrase;
	result: ScoreResult;
}

interface SaveLessonInput {
	profileId: string;
	lesson: Lesson;
}

export async function ensureSchema(env: WorkerBindings) {
	if (!schemaPromise) {
		schemaPromise = env.PRACTICE_DB
			.batch(SCHEMA_STATEMENTS.map((statement) => env.PRACTICE_DB.prepare(statement)))
			.then(() => undefined);
	}

	return schemaPromise;
}

export async function loadPracticeState(env: WorkerBindings, profileId: string): Promise<PracticeState | null> {
	await ensureSchema(env);

	const profile = await env.PRACTICE_DB
		.prepare(`
			SELECT id, preferred_language, preferred_topic, preferred_difficulty, native_language
			FROM profiles
			WHERE id = ?
		`)
		.bind(profileId)
		.first<ProfileRow>();

	if (!profile) {
		return null;
	}

	const recentLessonRows = await env.PRACTICE_DB
		.prepare(`
			SELECT id, language, transcription_code, topic, difficulty, native_language, title, intro, created_at
			FROM lessons
			WHERE profile_id = ?
			ORDER BY created_at DESC
			LIMIT ?
		`)
		.bind(profileId, MAX_RECENT_LESSONS)
		.all<LessonRow>();

	const lessons = await hydrateLessons(env, recentLessonRows.results ?? []);

	const attempts = await env.PRACTICE_DB
		.prepare(`
			SELECT id, lesson_id, phrase_id, phrase_text, language, score, user_transcription, feedback, created_at
			FROM practice_attempts
			WHERE profile_id = ?
			ORDER BY created_at DESC
			LIMIT ?
		`)
		.bind(profileId, MAX_ATTEMPTS)
		.all<AttemptRow>();

	const reviewRows = await env.PRACTICE_DB
		.prepare(`
			SELECT id, language, topic, difficulty, phrase_id, phrase_text, translation, romanization, tip, last_score, last_practiced_at, review_count, success_count
			FROM review_phrases
			WHERE profile_id = ?
			ORDER BY last_score ASC, last_practiced_at DESC
		`)
		.bind(profileId)
		.all<ReviewRow>();

	return {
		preferences: {
			language: profile.preferred_language || DEFAULT_PREFERENCES.language,
			topic: profile.preferred_topic || DEFAULT_PREFERENCES.topic,
			difficulty: difficultyValue(profile.preferred_difficulty, DEFAULT_PREFERENCES.difficulty),
			nativeLanguage: profile.native_language || DEFAULT_PREFERENCES.nativeLanguage,
		},
		savedPhrases: (reviewRows.results ?? []).map(mapReviewPhrase),
		attempts: (attempts.results ?? []).map(mapAttempt),
		recentLessons: lessons,
		lastLesson: lessons[0] ?? null,
	};
}

export async function saveLessonForProfile(env: WorkerBindings, input: SaveLessonInput) {
	await ensureSchema(env);

	const timestamp = new Date().toISOString();
	const statements = [
		env.PRACTICE_DB.prepare(`
			INSERT INTO profiles (id, preferred_language, preferred_topic, preferred_difficulty, native_language, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				preferred_language = excluded.preferred_language,
				preferred_topic = excluded.preferred_topic,
				preferred_difficulty = excluded.preferred_difficulty,
				native_language = excluded.native_language,
				updated_at = excluded.updated_at
		`).bind(
			input.profileId,
			input.lesson.language,
			input.lesson.topic,
			input.lesson.difficulty,
			input.lesson.nativeLanguage,
			timestamp,
			timestamp,
		),
		env.PRACTICE_DB.prepare(`
			INSERT OR REPLACE INTO lessons (id, profile_id, language, transcription_code, topic, difficulty, native_language, title, intro, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			input.lesson.id,
			input.profileId,
			input.lesson.language,
			input.lesson.transcriptionCode,
			input.lesson.topic,
			input.lesson.difficulty,
			input.lesson.nativeLanguage,
			input.lesson.title,
			input.lesson.intro,
			input.lesson.createdAt,
		),
	];

	for (const [index, phrase] of input.lesson.phrases.entries()) {
		statements.push(
			env.PRACTICE_DB.prepare(`
				INSERT OR REPLACE INTO lesson_phrases (id, lesson_id, text_value, translation, romanization, difficulty, tip, sort_order)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				phrase.id,
				input.lesson.id,
				phrase.text,
				phrase.translation,
				phrase.romanization ?? null,
				phrase.difficulty,
				phrase.tip,
				index,
			),
		);
	}

	await env.PRACTICE_DB.batch(statements);
}

export async function recordPracticeResult(env: WorkerBindings, input: RecordAttemptInput) {
	await ensureSchema(env);

	const attemptId = crypto.randomUUID();
	const timestamp = new Date().toISOString();

	await env.PRACTICE_DB.prepare(`
		INSERT INTO practice_attempts (id, profile_id, lesson_id, phrase_id, phrase_text, language, score, user_transcription, feedback, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).bind(
		attemptId,
		input.profileId,
		input.lesson.id,
		input.phrase.id,
		input.phrase.text,
		input.lesson.language,
		input.result.score,
		input.result.userTranscription,
		input.result.feedback,
		timestamp,
	).run();

	const existing = await env.PRACTICE_DB.prepare(`
		SELECT id, review_count, success_count
		FROM review_phrases
		WHERE profile_id = ? AND language = ? AND phrase_text = ?
	`).bind(
		input.profileId,
		input.lesson.language,
		input.phrase.text,
	).first<{ id: string; review_count: number; success_count: number }>();

	if (input.result.score >= WEAK_SCORE_THRESHOLD) {
		if (!existing) {
			return;
		}

		const nextSuccessCount = existing.success_count + 1;
		if (nextSuccessCount >= MASTERED_SUCCESS_COUNT && input.result.score >= MASTERED_SCORE) {
			await env.PRACTICE_DB.prepare(`
				DELETE FROM review_phrases
				WHERE id = ?
			`).bind(existing.id).run();
			return;
		}

		await env.PRACTICE_DB.prepare(`
			UPDATE review_phrases
			SET phrase_id = ?, topic = ?, difficulty = ?, translation = ?, romanization = ?, tip = ?, last_score = ?, last_practiced_at = ?, review_count = ?, success_count = ?
			WHERE id = ?
		`).bind(
			input.phrase.id,
			input.lesson.topic,
			input.phrase.difficulty,
			input.phrase.translation,
			input.phrase.romanization ?? null,
			input.phrase.tip,
			input.result.score,
			timestamp,
			existing.review_count + 1,
			nextSuccessCount,
			existing.id,
		).run();
		return;
	}

	if (existing) {
		await env.PRACTICE_DB.prepare(`
			UPDATE review_phrases
			SET phrase_id = ?, topic = ?, difficulty = ?, translation = ?, romanization = ?, tip = ?, last_score = ?, last_practiced_at = ?, review_count = ?, success_count = 0
			WHERE id = ?
		`).bind(
			input.phrase.id,
			input.lesson.topic,
			input.phrase.difficulty,
			input.phrase.translation,
			input.phrase.romanization ?? null,
			input.phrase.tip,
			input.result.score,
			timestamp,
			existing.review_count + 1,
			existing.id,
		).run();
		return;
	}

	await env.PRACTICE_DB.prepare(`
		INSERT INTO review_phrases (id, profile_id, language, topic, difficulty, phrase_id, phrase_text, translation, romanization, tip, last_score, last_practiced_at, review_count, success_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`).bind(
		crypto.randomUUID(),
		input.profileId,
		input.lesson.language,
		input.lesson.topic,
		input.phrase.difficulty,
		input.phrase.id,
		input.phrase.text,
		input.phrase.translation,
		input.phrase.romanization ?? null,
		input.phrase.tip,
		input.result.score,
		timestamp,
		1,
		0,
	).run();
}

async function hydrateLessons(env: WorkerBindings, lessonRows: LessonRow[]): Promise<Lesson[]> {
	if (lessonRows.length === 0) {
		return [];
	}

	const placeholders = lessonRows.map(() => "?").join(", ");
	const phraseRows = await env.PRACTICE_DB.prepare(`
		SELECT id, lesson_id, text_value, translation, romanization, difficulty, tip, sort_order
		FROM lesson_phrases
		WHERE lesson_id IN (${placeholders})
		ORDER BY lesson_id, sort_order ASC
	`).bind(...lessonRows.map((lesson) => lesson.id)).all<LessonPhraseRow>();

	const phrasesByLesson = new Map<string, Phrase[]>();
	for (const row of phraseRows.results ?? []) {
		const phrases = phrasesByLesson.get(row.lesson_id) ?? [];
		phrases.push({
			id: row.id,
			text: row.text_value,
			translation: row.translation,
			romanization: row.romanization ?? undefined,
			difficulty: difficultyValue(row.difficulty, "easy"),
			tip: row.tip,
		});
		phrasesByLesson.set(row.lesson_id, phrases);
	}

	return lessonRows.map((row) => ({
		id: row.id,
		language: row.language,
		transcriptionCode: row.transcription_code,
		topic: row.topic,
		difficulty: difficultyValue(row.difficulty, "easy"),
		nativeLanguage: row.native_language,
		createdAt: row.created_at,
		title: row.title,
		intro: row.intro,
		phrases: phrasesByLesson.get(row.id) ?? [],
	}));
}

function mapAttempt(row: AttemptRow): PracticeAttempt {
	return {
		id: row.id,
		lessonId: row.lesson_id,
		phraseId: row.phrase_id,
		phraseText: row.phrase_text,
		language: row.language,
		score: row.score,
		userTranscription: row.user_transcription,
		feedback: row.feedback,
		createdAt: row.created_at,
	};
}

function mapReviewPhrase(row: ReviewRow): SavedPhrase {
	return {
		id: row.id,
		language: row.language,
		topic: row.topic,
		difficulty: difficultyValue(row.difficulty, "easy"),
		phrase: {
			id: row.phrase_id,
			text: row.phrase_text,
			translation: row.translation,
			romanization: row.romanization ?? undefined,
			difficulty: difficultyValue(row.difficulty, "easy"),
			tip: row.tip,
		},
		lastScore: row.last_score,
		lastPracticedAt: row.last_practiced_at,
		reviewCount: row.review_count,
		successCount: row.success_count,
	};
}

function difficultyValue(value: string, fallback: Difficulty): Difficulty {
	return value === "easy" || value === "medium" || value === "hard" ? value : fallback;
}

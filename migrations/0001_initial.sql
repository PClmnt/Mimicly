CREATE TABLE IF NOT EXISTS profiles (
	id TEXT PRIMARY KEY,
	preferred_language TEXT NOT NULL,
	preferred_topic TEXT NOT NULL,
	preferred_difficulty TEXT NOT NULL,
	native_language TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
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
);

CREATE TABLE IF NOT EXISTS lesson_phrases (
	id TEXT PRIMARY KEY,
	lesson_id TEXT NOT NULL,
	text_value TEXT NOT NULL,
	translation TEXT NOT NULL,
	romanization TEXT,
	difficulty TEXT NOT NULL,
	tip TEXT NOT NULL,
	sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_attempts (
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
);

CREATE TABLE IF NOT EXISTS review_phrases (
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
);

CREATE INDEX IF NOT EXISTS idx_lessons_profile_created_at ON lessons(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_profile_created_at ON practice_attempts(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_profile_score ON review_phrases(profile_id, last_score ASC, last_practiced_at DESC);

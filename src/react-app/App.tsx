import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { HomeScreen } from "./components/HomeScreen";
import { PracticeSession } from "./components/PracticeSession";
import { DEFAULT_PHRASE_COUNT, REVIEW_SESSION_SIZE } from "./constants";
import { requestLesson } from "./api";
import { buildPracticeStats, createReviewLesson, loadPracticeState, recordPracticeAttempt, rememberLesson, savePracticeState } from "./storage";
import { getLanguageOption } from "../shared/languages";
import type { Lesson, Preferences, ScoreResult } from "./types";

type SessionMode = "lesson" | "review";

interface ActiveSession {
	lesson: Lesson;
	mode: SessionMode;
}

function App() {
	const [practiceState, setPracticeState] = useState(loadPracticeState);
	const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
	const [isLoadingLesson, setIsLoadingLesson] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		savePracticeState(practiceState);
	}, [practiceState]);

	const stats = useMemo(() => buildPracticeStats(practiceState), [practiceState]);
	const reviewLanguage = useMemo(() => {
		const preferredLanguage = practiceState.savedPhrases.find((savedPhrase) => (
			savedPhrase.language === practiceState.preferences.language
		));

		return preferredLanguage?.language ?? practiceState.savedPhrases[0]?.language ?? null;
	}, [practiceState.preferences.language, practiceState.savedPhrases]);

	const reviewQueue = useMemo(() => {
		if (!reviewLanguage) {
			return [];
		}

		return practiceState.savedPhrases
			.filter((savedPhrase) => savedPhrase.language === reviewLanguage)
			.sort((left, right) => left.lastScore - right.lastScore)
			.slice(0, REVIEW_SESSION_SIZE);
	}, [practiceState.savedPhrases, reviewLanguage]);

	function setPreference(field: keyof Preferences, value: string) {
		setPracticeState((current) => ({
			...current,
			preferences: {
				...current.preferences,
				[field]: value,
			},
		}));
	}

	async function startLesson() {
		setIsLoadingLesson(true);
		setError("");

		try {
			const lesson = await requestLesson({
				...practiceState.preferences,
				phraseCount: DEFAULT_PHRASE_COUNT,
			});

			setPracticeState((current) => rememberLesson(current, lesson));
			setActiveSession({ lesson, mode: "lesson" });
		} catch (lessonError) {
			setError(lessonError instanceof Error ? lessonError.message : "Unable to create the lesson.");
		} finally {
			setIsLoadingLesson(false);
		}
	}

	function startReview() {
		const reviewLesson = createReviewLesson(reviewQueue);
		if (!reviewLesson) {
			return;
		}

		const baseLesson = practiceState.lastLesson;
		setActiveSession({
			lesson: {
				...reviewLesson,
				transcriptionCode: baseLesson?.language === reviewLesson.language
					? baseLesson.transcriptionCode
					: getLanguageOption(reviewLesson.language).transcriptionCode,
				nativeLanguage: practiceState.preferences.nativeLanguage,
			},
			mode: "review",
		});
	}

	function resumeLastLesson() {
		if (!practiceState.lastLesson) {
			return;
		}

		setError("");
		setActiveSession({ lesson: practiceState.lastLesson, mode: "lesson" });
	}

	function handleScored(phraseId: string, result: ScoreResult) {
		if (!activeSession) {
			return;
		}

		const phrase = activeSession.lesson.phrases.find((item) => item.id === phraseId);
		if (!phrase) {
			return;
		}

		setPracticeState((current) => recordPracticeAttempt(current, activeSession.lesson, phrase, result));
	}

	return (
		<main className="app-root">
			<div className="app-content">
				<AppHeader stats={stats} />

				{activeSession ? (
					<PracticeSession
						lesson={activeSession.lesson}
						mode={activeSession.mode}
						reviewQueue={practiceState.savedPhrases}
						onBack={() => setActiveSession(null)}
						onScored={handleScored}
					/>
				) : (
					<HomeScreen
						error={error}
						isLoading={isLoadingLesson}
						lastLesson={practiceState.lastLesson}
						preferences={practiceState.preferences}
						recentLessons={practiceState.recentLessons}
						reviewQueue={reviewQueue}
						stats={stats}
						onPreferenceChange={setPreference}
						onResumeLastLesson={resumeLastLesson}
						onStartLesson={startLesson}
						onStartReview={startReview}
					/>
				)}
			</div>
		</main>
	);
}

export default App;

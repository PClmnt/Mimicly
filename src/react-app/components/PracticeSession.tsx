import { useEffect, useMemo, useRef, useState } from "react";
import { requestSceneImage, requestSpeech } from "../api";
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon } from "../assets/icons";
import { PhraseCard } from "./PhraseCard";
import type { Lesson, SavedPhrase, ScoreResult } from "../types";

interface PracticeSessionProps {
	lesson: Lesson;
	mode: "lesson" | "review";
	reviewQueue: SavedPhrase[];
	onBack: () => void;
	onScored: (phraseId: string, result: ScoreResult) => void;
}

export function PracticeSession({
	lesson,
	mode,
	reviewQueue,
	onBack,
	onScored,
}: PracticeSessionProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
	const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
	const [sceneUrls, setSceneUrls] = useState<Record<string, string | null>>({});
	const [sceneLoading, setSceneLoading] = useState<Record<string, boolean>>({});
	const [results, setResults] = useState<Record<string, ScoreResult>>({});
	const [isComplete, setIsComplete] = useState(false);
	const audioUrlsRef = useRef(audioUrls);

	const phrase = lesson.phrases[currentIndex];
	const sessionScores = useMemo(() => Object.values(results).map((result) => result.score), [results]);
	const averageScore = sessionScores.length === 0
		? 0
		: Math.round(sessionScores.reduce((sum, value) => sum + value, 0) / sessionScores.length);

	useEffect(() => {
		audioUrlsRef.current = audioUrls;
	}, [audioUrls]);

	useEffect(() => {
		setCurrentIndex(0);
		setAudioUrls({});
		setAudioLoading({});
		setSceneUrls({});
		setSceneLoading({});
		setResults({});
		setIsComplete(false);
	}, [lesson.id]);

	useEffect(() => {
		return () => {
			Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
		};
	}, []);

	useEffect(() => {
		void ensureAudio(lesson.phrases[currentIndex]);
		if (lesson.phrases[currentIndex + 1]) {
			void ensureAudio(lesson.phrases[currentIndex + 1]);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentIndex, lesson.id]);

	async function ensureAudio(targetPhrase = phrase) {
		if (!targetPhrase || audioUrls[targetPhrase.id] || audioLoading[targetPhrase.id]) {
			return audioUrls[targetPhrase.id] ?? null;
		}

		setAudioLoading((current) => ({ ...current, [targetPhrase.id]: true }));

		try {
			const blob = await requestSpeech(targetPhrase.text, lesson.language);
			const url = URL.createObjectURL(blob);
			setAudioUrls((current) => ({ ...current, [targetPhrase.id]: url }));
			return url;
		} finally {
			setAudioLoading((current) => ({ ...current, [targetPhrase.id]: false }));
		}
	}

	async function ensureScene() {
		if (sceneUrls[phrase.id] || sceneLoading[phrase.id]) {
			return;
		}

		setSceneLoading((current) => ({ ...current, [phrase.id]: true }));

		try {
			const imageUrl = await requestSceneImage(phrase.text, phrase.translation, lesson.language);
			setSceneUrls((current) => ({ ...current, [phrase.id]: imageUrl }));
		} finally {
			setSceneLoading((current) => ({ ...current, [phrase.id]: false }));
		}
	}

	function handleScored(result: ScoreResult) {
		setResults((current) => ({ ...current, [phrase.id]: result }));
		onScored(phrase.id, result);
	}

	function handleNext() {
		if (currentIndex === lesson.phrases.length - 1) {
			setIsComplete(true);
			return;
		}

		setCurrentIndex((index) => index + 1);
	}

	if (isComplete) {
		return (
			<section className="session-shell">
				<div className="panel panel--primary">
					<p className="panel-eyebrow">{mode === "review" ? "Review complete" : "Session complete"}</p>
					<h2 className="panel-title">Average score: {averageScore}</h2>
					<p className="panel-copy">
						{mode === "review"
							? "Any phrase still under 90 stays in the queue. Strong repetitions clear it out."
							: "Weak phrases were saved automatically. Come back to review them until they disappear."}
					</p>

					<div className="action-row">
						<button className="primary-button" onClick={onBack}>
							Back to dashboard
						</button>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className="session-shell">
			<div className="session-meta">
				<button className="text-button" onClick={onBack}>
					<RefreshIcon />
					<span>Back to dashboard</span>
				</button>

				<div className="session-copy">
					<span className="badge">{mode === "review" ? "Review" : "Lesson"}</span>
					<h2 className="session-title">{lesson.title}</h2>
					<p className="session-intro">{lesson.intro}</p>
				</div>
			</div>

			<div className="progress-header">
				<div className="progress-copy">
					<span className="progress-count">
						Phrase {currentIndex + 1} of {lesson.phrases.length}
					</span>
					<div className="progress-bar" aria-hidden="true">
						<div
							className="progress-bar-fill"
							style={{ width: `${((currentIndex + 1) / lesson.phrases.length) * 100}%` }}
						/>
					</div>
				</div>
				<div className="session-summary">
					<span>{Object.keys(results).length} scored</span>
					<span>{reviewQueue.length} in review</span>
				</div>
			</div>

			<div className="session-grid">
				<PhraseCard
					audioUrl={audioUrls[phrase.id] ?? null}
					imageUrl={sceneUrls[phrase.id] ?? null}
					imageLoading={sceneLoading[phrase.id] ?? false}
					language={lesson.language}
					phrase={phrase}
					transcriptionCode={lesson.transcriptionCode}
					onGenerateImage={ensureScene}
					onLoadAudio={() => ensureAudio(phrase)}
					onScored={handleScored}
				/>

				<aside className="panel session-sidebar">
					<div className="panel-header panel-header--tight">
						<div>
							<p className="panel-eyebrow">This session</p>
							<h3 className="panel-title">Keep the loop tight</h3>
						</div>
					</div>

					<ul className="check-list">
						<li>Listen once before recording.</li>
						<li>Repeat until the score feels stable, not lucky.</li>
						<li>Use scene images only when a phrase will not stick.</li>
					</ul>

					{results[phrase.id] && (
						<div className="mini-stat-card">
							<span className="mini-stat-value">{results[phrase.id].score}</span>
							<span className="mini-stat-label">Current phrase score</span>
						</div>
					)}

					<div className="nav-row">
						<button
							className="icon-button"
							onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
							disabled={currentIndex === 0}
							aria-label="Previous phrase"
						>
							<ChevronLeftIcon />
						</button>
						<button className="primary-button primary-button--compact" onClick={handleNext}>
							<span>{currentIndex === lesson.phrases.length - 1 ? "Finish session" : "Next phrase"}</span>
							<ChevronRightIcon />
						</button>
					</div>
				</aside>
			</div>
		</section>
	);
}

import { DIFFICULTY_OPTIONS, LANGUAGES, TOPIC_SUGGESTIONS } from "../constants";
import type { Lesson, Preferences, PracticeStats, SavedPhrase } from "../types";

interface HomeScreenProps {
	error: string;
	isLoading: boolean;
	lastLesson: Lesson | null;
	preferences: Preferences;
	recentLessons: Lesson[];
	reviewQueue: SavedPhrase[];
	stats: PracticeStats;
	onPreferenceChange: (field: keyof Preferences, value: string) => void;
	onResumeLastLesson: () => void;
	onStartLesson: () => void;
	onStartReview: () => void;
}

export function HomeScreen({
	error,
	isLoading,
	lastLesson,
	preferences,
	recentLessons,
	reviewQueue,
	stats,
	onPreferenceChange,
	onResumeLastLesson,
	onStartLesson,
	onStartReview,
}: HomeScreenProps) {
	return (
		<section className="dashboard">
			<div className="panel panel--primary">
				<div className="panel-header">
					<div>
						<p className="panel-eyebrow">New session</p>
						<h2 className="panel-title">Build a focused practice set</h2>
					</div>
					<p className="panel-copy">
						The lesson appears first. Audio preloads in the background. Scene art is optional.
					</p>
				</div>

				<div className="setup-grid">
					<label className="field">
						<span className="field-label">Language</span>
						<select
							className="field-control"
							value={preferences.language}
							onChange={(event) => onPreferenceChange("language", event.target.value)}
							disabled={isLoading}
						>
							{LANGUAGES.map((language) => (
								<option key={language.value} value={language.value}>
									{language.label}
								</option>
							))}
						</select>
					</label>

					<label className="field">
						<span className="field-label">Difficulty</span>
						<select
							className="field-control"
							value={preferences.difficulty}
							onChange={(event) => onPreferenceChange("difficulty", event.target.value)}
							disabled={isLoading}
						>
							{DIFFICULTY_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<label className="field field--wide">
						<span className="field-label">Topic</span>
						<input
							className="field-control"
							list="topic-suggestions"
							value={preferences.topic}
							onChange={(event) => onPreferenceChange("topic", event.target.value)}
							disabled={isLoading}
							placeholder="Ordering at a cafe"
						/>
						<datalist id="topic-suggestions">
							{TOPIC_SUGGESTIONS.map((topic) => (
								<option key={topic} value={topic} />
							))}
						</datalist>
					</label>

					<label className="field field--wide">
						<span className="field-label">Native language</span>
						<input
							className="field-control"
							value={preferences.nativeLanguage}
							onChange={(event) => onPreferenceChange("nativeLanguage", event.target.value)}
							disabled={isLoading}
							placeholder="English"
						/>
					</label>
				</div>

				<div className="action-row setup-actions">
					<button className="primary-button" onClick={onStartLesson} disabled={isLoading}>
						{isLoading ? "Building session..." : "Start practice"}
					</button>
					{lastLesson && (
						<button className="secondary-button" onClick={onResumeLastLesson} disabled={isLoading}>
							Resume last session
						</button>
					)}
				</div>

				{error && <p className="inline-error">{error}</p>}
			</div>

			<div className="dashboard-grid">
				<div className="panel">
					<div className="panel-header panel-header--tight">
						<div>
							<p className="panel-eyebrow">Review queue</p>
							<h2 className="panel-title">Practice what you missed</h2>
						</div>
						<p className="panel-copy">
							Every low-scoring phrase is saved automatically until you clear it.
						</p>
					</div>

					{reviewQueue.length === 0 ? (
						<p className="empty-state">No weak phrases yet. Miss a phrase and it will show up here.</p>
					) : (
						<>
							<ul className="phrase-list">
								{reviewQueue.slice(0, 4).map((savedPhrase) => (
									<li key={savedPhrase.id} className="phrase-list-item">
										<div>
											<p className="phrase-list-text">{savedPhrase.phrase.text}</p>
											<p className="phrase-list-meta">
												{savedPhrase.topic} · last score {savedPhrase.lastScore}
											</p>
										</div>
										<span className="badge badge--warn">{savedPhrase.language}</span>
									</li>
								))}
							</ul>
							<button className="secondary-button secondary-button--full" onClick={onStartReview}>
								Start review session
							</button>
						</>
					)}
				</div>

				<div className="panel">
					<div className="panel-header panel-header--tight">
						<div>
							<p className="panel-eyebrow">Momentum</p>
							<h2 className="panel-title">Recent work</h2>
						</div>
						<p className="panel-copy">
							{stats.recentPracticeCount} attempts in the last 7 days.
						</p>
					</div>

					{recentLessons.length === 0 ? (
						<p className="empty-state">Your generated lessons will appear here for quick restart.</p>
					) : (
						<ul className="lesson-list">
							{recentLessons.map((lesson) => (
								<li key={lesson.id} className="lesson-list-item">
									<div>
										<p className="lesson-list-title">{lesson.title}</p>
										<p className="lesson-list-meta">
											{lesson.language} · {lesson.topic}
										</p>
									</div>
									<span className="badge">{lesson.phrases.length} phrases</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</section>
	);
}

import type { PracticeStats } from "../types";

export function AppHeader({ stats }: { stats: PracticeStats }) {
	return (
		<header className="app-header">
			<div className="app-eyebrow">Language practice that remembers what you miss</div>
			<h1 className="app-title">Mimicly</h1>
			<p className="app-subtitle">
				Hear the phrase, say it back, fix the weak spots, then review them later.
			</p>

			<div className="hero-stats" aria-label="Practice summary">
				<div className="hero-stat">
					<span className="hero-stat-value">{stats.totalAttempts}</span>
					<span className="hero-stat-label">Attempts saved</span>
				</div>
				<div className="hero-stat">
					<span className="hero-stat-value">{stats.averageScore}</span>
					<span className="hero-stat-label">Average score</span>
				</div>
				<div className="hero-stat">
					<span className="hero-stat-value">{stats.weakPhraseCount}</span>
					<span className="hero-stat-label">Needs review</span>
				</div>
			</div>
		</header>
	);
}

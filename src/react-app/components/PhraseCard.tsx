import { useEffect, useRef, useState } from "react";
import { CheckIcon, MicSmallIcon, PauseIcon, PlayIcon, RefreshIcon, SparkleIcon, StopIcon } from "../assets/icons";
import { scorePhrase } from "../api";
import type { Phrase, ScoreResult } from "../types";

interface PhraseCardProps {
	audioUrl: string | null;
	imageUrl: string | null;
	imageLoading: boolean;
	language: string;
	lessonDifficulty: string;
	lessonId: string;
	phrase: Phrase;
	profileId: string;
	topic: string;
	transcriptionCode: string;
	onGenerateImage: () => void;
	onLoadAudio: () => Promise<string | null>;
	onScored: (result: ScoreResult) => void;
}

type CardPhase = "idle" | "recording" | "scoring" | "result";

export function PhraseCard({
	audioUrl,
	imageUrl,
	imageLoading,
	language,
	lessonDifficulty,
	lessonId,
	phrase,
	profileId,
	topic,
	transcriptionCode,
	onGenerateImage,
	onLoadAudio,
	onScored,
}: PhraseCardProps) {
	const [cardPhase, setCardPhase] = useState<CardPhase>("idle");
	const [error, setError] = useState("");
	const [isPlaying, setIsPlaying] = useState(false);
	const [result, setResult] = useState<ScoreResult | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);

	useEffect(() => {
		setCardPhase("idle");
		setError("");
		setResult(null);
		setIsPlaying(false);
		audioRef.current?.pause();
		audioRef.current = null;
		if (recorderRef.current && recorderRef.current.state !== "inactive") {
			recorderRef.current.stop();
		}
		recorderRef.current = null;
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;

		return () => {
			audioRef.current?.pause();
			if (recorderRef.current && recorderRef.current.state !== "inactive") {
				recorderRef.current.stop();
			}
			recorderRef.current = null;
			streamRef.current?.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		};
	}, [phrase.id]);

	async function handlePlayAudio() {
		setError("");

		const playableUrl = audioUrl ?? await onLoadAudio();
		if (!playableUrl) {
			return;
		}

		audioRef.current?.pause();
		audioRef.current = new Audio(playableUrl);
		audioRef.current.onended = () => setIsPlaying(false);
		await audioRef.current.play();
		setIsPlaying(true);
	}

	function handlePauseAudio() {
		audioRef.current?.pause();
		setIsPlaying(false);
	}

	async function handleStartRecording() {
		setError("");

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;

			const recorder = new MediaRecorder(stream);
			recorderRef.current = recorder;
			chunksRef.current = [];

			recorder.ondataavailable = (event) => {
				chunksRef.current.push(event.data);
			};

			recorder.onstop = async () => {
				await handleScoreAttempt();
			};

			recorder.start();
			setCardPhase("recording");
		} catch {
			setError("Microphone access failed. Check browser permissions and try again.");
		}
	}

	function handleStopRecording() {
		recorderRef.current?.stop();
		stopTracks();
		setCardPhase("scoring");
	}

	async function handleScoreAttempt() {
		try {
			const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType ?? "audio/webm" });
			const nextResult = await scorePhrase({
				audio: blob,
				difficulty: lessonDifficulty,
				language,
				lessonId,
				phrase,
				profileId,
				targetPhrase: phrase.text,
				topic,
				transcriptionCode,
			});
			setResult(nextResult);
			setCardPhase("result");
			onScored(nextResult);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : "Scoring failed.");
			setCardPhase("idle");
		} finally {
			stopActiveRecording();
		}
	}

	function stopTracks() {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
	}

	function stopActiveRecording() {
		if (recorderRef.current && recorderRef.current.state !== "inactive") {
			recorderRef.current.stop();
		}
		recorderRef.current = null;
		stopTracks();
	}

	const difficultyLabel = phrase.difficulty === "easy" ? "Easy" : phrase.difficulty === "medium" ? "Medium" : "Hard";

	return (
		<article className="phrase-card">
			<div className="card-visual">
				{imageUrl ? (
					<img src={imageUrl} alt={phrase.translation} className="card-image" />
				) : (
					<div className="card-image-placeholder">
						<div className="card-image-copy">
							<p className="card-image-eyebrow">Optional visual</p>
							<p className="card-image-title">Generate a scene only if you need a memory hook.</p>
							<button className="secondary-button" onClick={onGenerateImage} disabled={imageLoading}>
								<SparkleIcon />
								<span>{imageLoading ? "Generating..." : "Create scene"}</span>
							</button>
						</div>
					</div>
				)}

				<span className={`badge badge--difficulty badge--${phrase.difficulty}`}>{difficultyLabel}</span>
			</div>

			<div className="card-body">
				<div className="phrase-heading">
					<p className="card-phrase">{phrase.text}</p>
					{phrase.romanization && <p className="card-romanization">{phrase.romanization}</p>}
					<p className="card-translation">{phrase.translation}</p>
					<p className="card-tip">{phrase.tip}</p>
				</div>

				<div className="card-actions">
					<button className="secondary-button" onClick={isPlaying ? handlePauseAudio : handlePlayAudio}>
						{isPlaying ? <PauseIcon /> : <PlayIcon />}
						<span>{isPlaying ? "Pause audio" : "Listen first"}</span>
					</button>

					{cardPhase === "recording" ? (
						<button className="danger-button" onClick={handleStopRecording}>
							<StopIcon />
							<span>Stop recording</span>
						</button>
					) : (
						<button className="primary-button" onClick={handleStartRecording} disabled={cardPhase === "scoring"}>
							<MicSmallIcon />
							<span>{cardPhase === "scoring" ? "Scoring..." : "Record attempt"}</span>
						</button>
					)}
				</div>

				{error && <p className="inline-error">{error}</p>}

				{cardPhase === "scoring" && (
					<div className="feedback-panel feedback-panel--pending">
						<div className="spinner" />
						<p>Scoring your pronunciation...</p>
					</div>
				)}

				{result && (
					<div className="feedback-panel">
						<div className="feedback-score-row">
							<div className="score-chip">
								<span className="score-chip-value">{result.score}</span>
								<span className="score-chip-label">score</span>
							</div>
							{result.perfect && (
								<div className="perfect-pill">
									<CheckIcon />
									<span>Locked in</span>
								</div>
							)}
						</div>

						<p className="feedback-copy">{result.feedback}</p>
						<p className="feedback-next-step">{result.nextStep}</p>

						<div className="heard-box">
							<span className="heard-box-label">We heard</span>
							<span className="heard-box-value">{result.userTranscription || "No clear transcription"}</span>
						</div>

						{result.differences.length > 0 && (
							<ul className="difference-list">
								{result.differences.map((difference) => (
									<li key={difference}>{difference}</li>
								))}
							</ul>
						)}

						<button
							className="secondary-button secondary-button--full"
							onClick={() => {
								setCardPhase("idle");
								setResult(null);
							}}
						>
							<RefreshIcon />
							<span>Try again</span>
						</button>
					</div>
				)}
			</div>
		</article>
	);
}

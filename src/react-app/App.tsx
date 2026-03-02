// src/App.tsx

import { useEffect, useRef, useState } from "react";
import { MicIcon, StopIcon } from "./assets/icons";
type RecordState = "idle" | "recording";


const WAVE_BARS = 11;

function App() {
	const [name, setName] = useState("unknown");
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("")
	const [recordState, setRecordState] = useState<RecordState>("idle");
	const [recordedAudio, setRecordedAudio] = useState<Blob>()

	const recorderRef = useRef<MediaRecorder | null>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const chunksRef = useRef<BlobPart[]>([])

	const toggleRecording = async () => {
		if (recordState === "idle") {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			streamRef.current = stream
			const recorder = new MediaRecorder(stream)
			chunksRef.current = []
			recorder.ondataavailable = (e) => {
				console.log(e.data)
				chunksRef.current.push
			}
			recorder.onstop = () => {
				setRecordedAudio(new Blob(chunksRef.current, { type: recorder.mimeType }))
			}

			recorder?.start()
		} else if (recordState === "recording") {
			recorderRef?.current?.stop()
			streamRef?.current?.getTracks().forEach(track => track.stop())

		}
		setRecordState(prev => prev === "idle" ? "recording" : "idle");

	};

	useEffect(() => {
		let ignore = false
		let controller = new AbortController()

		if (recordedAudio && recordState === "idle") {
			async function run() {
				let formData = new FormData()
				if (recordedAudio) {
					formData.append("audio", recordedAudio, 'recording.webm')
				}
				const resp = await fetch('/api/transcribe', {
					method: "POST",
					body: formData,
					signal: controller.signal
				})

				const transcription = await resp.json()
				setOutput(transcription)
			}

			void run()

		}
		return () => {
			ignore = true
			controller.abort()
		}

	}, [recordedAudio, recordState])


	const onSubmit = async () => {
		const resp = await fetch("/api/transcribe", {
			method: "POST",
			body: JSON.stringify(input)
		})
		const test = await resp.json()
		setOutput(test.response)
	}

	return (
		<main className="app-root">
			<div className="app-content">

				<header className="app-header">
					<div className="app-eyebrow">Powered by Mistral AI</div>
					<h1 className="app-title">Mimicly</h1>
					<p className="app-subtitle">Speak freely — we'll handle the rest.</p>
				</header>

				<section className="recorder-section">
					<div className={`waveform ${recordState === "recording" ? "waveform--active" : ""}`} aria-hidden="true">
						{Array.from({ length: WAVE_BARS }).map((_, i) => (
							<span
								key={i}
								className="wave-bar"
								style={{ animationDelay: `${i * 0.065}s` }}
							/>
						))}
					</div>

					<button
						className={`record-btn ${recordState === "recording" ? "record-btn--recording" : ""}`}
						onClick={toggleRecording}
						aria-label={recordState === "recording" ? "Stop recording" : "Start recording"}
					>
						{recordState === "idle" ? <MicIcon /> : <StopIcon />}
					</button>

					<p className="record-status">
						{recordState === "idle" ? "Tap to begin recording" : "Recording · Tap to stop"}
					</p>
				</section>

				{(output || recordState === "recording") && (
					<section className="transcript-section">
						<div className="transcript-label">Transcript</div>
						<div className="transcript-body">
							{output
								? <p className="transcript-text">{output}</p>
								: <p className="transcript-placeholder">Listening…</p>
							}
						</div>
					</section>
				)}

				{/* Backend integration wired up, hidden from UI until connected */}
				<div style={{ display: "none" }}>
					<input name="input" type="text" value={input} onChange={(e) => setInput(e.target.value)} />
					<button onClick={onSubmit}>Submit</button>
				</div>

			</div>
		</main>
	);
}

export default App;

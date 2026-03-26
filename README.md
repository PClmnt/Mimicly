# Mimicly

Mimicly is an AI-assisted pronunciation practice app for language learners who want tight feedback loops instead of passive flashcards.

It generates compact speaking lessons around a scenario, lets learners hear each phrase, record an attempt, and get immediate scoring and coaching. Missed phrases are saved into a review queue so weak spots stay visible until they improve.

## Features

### Focused lesson generation

- Builds short, scenario-based speaking lessons for a chosen language, topic, and difficulty.
- Keeps lessons compact so practice stays deliberate instead of sprawling.
- Adds short phrase-level cues to help learners focus on rhythm, stress, or pronunciation.

### Pronunciation-first practice loop

- Plays phrase audio before each attempt so learners hear the target clearly.
- Records the learner's response and scores the attempt against the target phrase.
- Returns direct feedback, a score, a short next step, and the transcription the system heard.

### Review memory

- Automatically saves weak phrases into a review queue.
- Keeps review focused on phrases that actually caused trouble.
- Removes phrases from the queue only after strong repeated performance.

### Faster, lower-friction experience

- Shows the lesson immediately instead of blocking on non-essential media generation.
- Prefetches phrase audio in the background for the current and next card.
- Treats scene images as optional memory aids rather than required content.

### Clean session flow

- Replaces the previous split demo modes with one clear product path.
- Supports fresh practice sessions, resuming the latest lesson, and targeted review sessions.
- Preserves recent lessons and local practice progress between visits on the same device.

### Multi-language support

- Supports Chinese, Japanese, Spanish, French, Korean, German, Italian, and Portuguese.
- Uses language-aware transcription settings so scoring is aligned with the selected language.
- Includes romanization only when it is useful for the target language.

## Tech Stack

- React 19 for the client application
- TypeScript across frontend and Worker code
- Bun for package management and script execution
- Vite for local development and production builds
- Hono for the Worker API layer
- Cloudflare Workers for deployment and edge execution
- Cloudflare D1 for lesson history, attempts, and review state
- Cloudflare Workers KV for lesson template caching
- Cloudflare R2 for generated audio and scene image storage
- OpenAI APIs for text-to-speech and optional scene image generation
- Mistral APIs for transcription, lesson generation, and pronunciation evaluation

## Product Summary

Mimicly is designed around one idea: speaking practice should be short, immediate, and repeatable.

Instead of generating content and leaving the learner on their own, it pushes each session toward a simple loop:

1. Generate a useful lesson.
2. Hear the phrase.
3. Say it back.
4. Get scored.
5. Revisit what was weak.

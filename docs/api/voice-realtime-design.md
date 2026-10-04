# Real-time voice conversation — feasibility & design

**Is streaming voice input possible? Yes — natively.** The Language Server ships a live
streaming speech-to-text pipeline, and it's wired to feed a cascade directly. The one missing
piece for a full spoken loop is **text-to-speech**, which the LS does *not* provide — the
agent's voice reply has to be synthesized externally.

Everything below is grounded in the actual RPCs (verified live: opening the transcription
stream immediately returns a `ready{ session_id }`).

---

## What the LS gives you (verified)

| RPC | Kind | Role |
|---|---|---|
| `StreamAudioTranscription(StartAudioTranscriptionRequest)` | → server-stream | Open a session; receive `ready{session_id}`, then `transcription{text, is_final}` updates, then `complete`. |
| `SendAudioChunk(SendAudioChunkRequest)` | unary (called repeatedly) | Push mic audio: `{ session_id, data: bytes, sequence_number }`. |
| `EndAudioSession(EndAudioSessionRequest)` | unary | Close the session. |
| `GetTranscription(GetTranscriptionRequest)` | unary | One-shot: whole `audio_data` buffer → `transcribed_text` (no streaming). |

Notably, `StartAudioTranscriptionRequest` carries `{ mime_type, model, pre_cursor_text,
post_cursor_text, cascade_id }` — the transcriber is **context-aware** (it knows the cascade
and surrounding text), so it's built for in-agent dictation, not just generic ASR.
`TranscriptionUpdate.is_final` separates interim vs. committed text — exactly what real-time
turn-taking needs.

**No TTS.** There is no `synthesize`/`speak` method anywhere in the LS. Voice *out* is your
responsibility (browser `SpeechSynthesis`, or a cloud/streaming TTS).

## End-to-end architecture

```
 ┌── mic ──► chunker/VAD ──► SendAudioChunk(seq++, bytes) ──┐
 │                                                          ▼
 │                                   StreamAudioTranscription (session)
 │   partial transcript (is_final=false) ◄── live caption UI
 │   final transcript   (is_final=true)  ──┐
 │                                          ▼
 │                        SendUserCascadeMessage(text)   ← the agent turn
 │                                          │
 │                        StreamAgentStateUpdates (text deltas, steps)
 │                                          ▼
 │                        sentence buffer ─► external TTS ─► speaker
 │                                          ▲
 └── barge-in: new speech while agent talks ─┴─► CancelCascadeSteps + stop TTS
```

Two long-lived server streams run concurrently: the **audio-transcription** stream and the
**cascade update** stream (`Cascade.listen()`). Manage each with its own `AbortController`.

## Turn-taking (endpointing)

The hardest part of "real-time conversation" isn't the transport — it's deciding *when the
user finished a sentence*. Options, best first:

1. **Trust `is_final`** from the transcriber, then debounce: commit a turn when a final
   arrives and no new audio follows for ~600–800 ms. Simple, uses server signal.
2. **Client VAD** (voice-activity detection): detect a silence gap in the mic stream and
   force-commit. Combine with (1) for snappier endpointing.
3. **Push-to-talk**: explicit start/stop. Trivial and robust; good for a first version.

Ship push-to-talk first, then layer VAD + `is_final` debouncing for hands-free.

## Barge-in (interruption)

Real conversation means the user can cut the agent off. When new speech is detected while a
cascade turn is streaming:
- `CancelCascadeSteps` / `ForceStopCascadeTree` on the active cascade,
- stop/flush the TTS queue,
- start a fresh turn from the new transcript.

Keep the mic stream **always open** so barge-in is detectable even while the agent talks.

## Latency tactics

- **Speak on sentence boundaries, not on turn-complete.** Feed cascade `text` deltas into a
  buffer, and as each sentence closes, hand it to a *streaming* TTS. First audio out in
  hundreds of ms instead of after the whole reply.
- **Show partial captions** (`is_final=false`) immediately; they cost nothing extra.
- **Trim the agent for conversation.** A voice assistant rarely needs the 20k-token coding
  system prompt. Use the minimal planner from
  [system-prompt-control §3b](system-prompt-control.md) (`declarativeMixinConfig`, empty) to
  cut first-token latency and cost dramatically — the reply-only agent still talks fine.
- **Pre-open** both streams before the user speaks; don't pay setup latency mid-conversation.

## SDK shape I'd add

A `VoiceSession` that hides the two streams and the chunk pump:

```ts
const voice = await client.startVoiceSession({
  cascade,                          // an existing Cascade to converse with
  mimeType: "audio/webm;codecs=opus",
  endpointing: { mode: "vad", silenceMs: 700 },
});

voice.on("partial", t => renderCaption(t));       // is_final=false
voice.on("final",   t => {/* auto-sent to cascade */});
voice.on("reply",   sentence => tts.speak(sentence)); // cascade text, chunked by sentence
voice.on("barge_in", () => tts.stop());

voice.pushAudio(pcmChunk);   // from mic; VoiceSession adds session_id + sequence_number
// …
await voice.close();         // EndAudioSession + aborts both streams
```

Internally `VoiceSession`:
1. opens `StreamAudioTranscription`, captures `session_id` from `ready`;
2. forwards `pushAudio()` bytes as `SendAudioChunk{ session_id, data, sequence_number++ }`;
3. emits `partial`/`final` from `TranscriptionUpdate`;
4. on `final` (after endpoint debounce) calls `cascade.sendMessage(text)`;
5. relays cascade `text` deltas as sentence-chunked `reply` events;
6. watches for new speech during a reply → `cascade.cancel()` + `barge_in`.

## Where each piece runs

- **Browser** (the [web-poc](../../src/server/web-poc/)): `MediaRecorder`/`AudioWorklet` for
  mic capture, `SpeechSynthesis` for TTS — a self-contained voice loop, no extra services.
- **Node**: capture via `sox`/`node-record-lpcm16`; TTS via a cloud API (no built-in speaker
  synthesis). Heavier, but scriptable/headless.

## Gotchas & open questions

- **Audio format**: `mime_type` is a free string; `audio/webm;codecs=opus` is the natural
  browser output. Confirm PCM (`audio/l16;rate=16000`) support for Node capture before
  committing — worth a quick `SendAudioChunk` probe.
- **`SendAudioChunk` is unary, not client-stream** — you call it once per chunk. Pick a chunk
  cadence (~100–250 ms) that balances latency vs. RPC overhead, and keep `sequence_number`
  monotonic so the server can order/detect drops.
- **No TTS ⇒ pick a voice engine early**; it shapes the latency budget more than anything else.
- **Two-way duplex needs the mic open during playback** for barge-in; handle the echo
  (headphones, or acoustic echo cancellation) so the agent doesn't transcribe itself.
- **Model field**: `StartAudioTranscriptionRequest.model` is a string; empty used the default
  in the liveness test. Enumerate valid transcription models if you need a specific one.

## Verdict

Real-time **voice-in, agent-out-as-text** is fully supported today and can be built on this
SDK now. A complete **spoken** assistant is ~80% here — the remaining 20% is bolting on a TTS
engine and the turn-taking/barge-in glue above. I'd build `VoiceSession` in the browser
web-poc first (mic + SpeechSynthesis), with the minimal-prompt conversational agent for low
latency.

## Related
- [`SendUserCascadeMessage`](send-user-cascade-message.md) · [`StreamCascadeReactiveUpdates`](stream-cascade-reactive-updates.md) (→ `StreamAgentStateUpdates`)
- [System-prompt control](system-prompt-control.md) — trim the agent for voice latency
- [Token usage](token-usage.md) — watch per-turn cost in a chatty voice loop

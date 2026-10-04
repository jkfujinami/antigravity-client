# 09 — 音声 (STT + 外部TTS + ターンテイキング)

**スコープ**（横断）：音声で会話する。入力は LS のストリーミングSTTを使い、出力は外部TTSで合成する
（LSにTTSは無い）。JARVIS 完成形の口と耳。詳細な実装設計は既存の API ドキュメントにある。

> **一次資料**：[../../api/voice-realtime-design.md](../../api/voice-realtime-design.md)
> （StreamAudioTranscription 検証済み、VoiceSession 設計、ターンテイキング/バージイン/レイテンシ戦略）。
> ここはそれを Runtime に組み込む観点だけを足す。

## 小分けドキュメント計画

- [ ] `voice-session.md` — `VoiceSession` を Runtime の入出力として統合（[04-perception](../04-perception/) 集音と共有）
- [ ] `tts.md` — 外部TTSエンジン選定（ブラウザ SpeechSynthesis / クラウド）とレイテンシ予算
- [ ] `turn-taking.md` — エンドポインティング（is_final debounce / VAD / push-to-talk）とバージイン
- [ ] `persona-voice.md` — persona に合った声・口調（簡潔/丁寧/ちょい皮肉）

## 現時点の知見

- **入力**：`StreamAudioTranscription` は検証済み（`ready{session_id}` 返却）。[04-perception](../04-perception/) の集音・話者分離の後段に繋ぐ。
- **出力**：LSに TTS は無い → 外部TTS必須。文単位で喋り出してレイテンシを稼ぐ。
- **軽量化**：会話用途は最小planner（`declarativeMixinConfig`）で first-token を短縮（[03-router](../03-router/) の T0/T1）。
- **バージイン**：割り込み時 `CancelCascadeSteps` + TTS停止（[api voice設計](../../api/voice-realtime-design.md)）。

## 未決事項
- TTSエンジン選定（最初に決めるとレイテンシ設計が固まる）。
- 話者分離済みマルチ入力との統合（[04-perception](../04-perception/) 未検証点と共有）。

## 関連
- [../../api/voice-realtime-design.md](../../api/voice-realtime-design.md) 一次資料 / [04-perception](../04-perception/) 集音 / [02-registry](../02-registry/) persona

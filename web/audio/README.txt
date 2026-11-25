Nocturn audio
=============

BGM
- web/audio/bgm.mp3

Character / transition voice WAVs
- web/audio/Ed/<emotion>/*.wav
- web/audio/Mute/<emotion>/*.wav
- web/audio/transition/*.wav

Examples
- web/audio/Ed/skeptical/01.wav
- web/audio/Ed/skeptical/02.wav
- web/audio/Mute/thinking/01.wav
- web/audio/transition/01.wav

The static reader cannot enumerate directories by itself. Open the Authoring Wizard after adding/removing WAV files (or press "Voice index 갱신"). The Wizard scans web/audio and rewrites web/audio/voice-index.json automatically.

If a matching folder has no WAV files, nothing is played. CAST voice is selected from the active speaker + CAST emotion folder. Lecture-transition voice is selected from web/audio/transition.

Per-book intro voice
- Use Wizard > 책 정보 > 책 진입 음성.
- The selected WAV is copied to that series as assets/book-intro.wav and referenced by meta.json as bookIntroAudio.
- It is played once when book.html is entered. If browser autoplay is blocked, playback is deferred to the first user gesture.

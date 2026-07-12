# Privacy

Speaking Editor is a local Obsidian plugin that reads your notes aloud inside the editor. It does not include analytics, telemetry, tracking pixels, or a remote service operated by this project.

## Text Sent to TTS Providers

When you press play, Speaking Editor turns the current note into text chunks and asks the active text-to-speech provider to synthesize audio. Text leaves your machine only at that moment, and only for the provider you have selected.

| Provider | Text leaves your machine? | Notes |
|---|---:|---|
| Edge TTS (default) | Yes | Uses the unofficial `msedge-tts` package against the same general service family used by Microsoft Edge Read Aloud. This is best effort and may change or stop working. Requires internet. |
| ElevenLabs | Yes | Uses ElevenLabs' official API with your API key. Requires internet. |
| macOS say | No | Runs locally through Apple's `say` command and does not send text to a network TTS provider. macOS only. |

Only the text needed for the requested audio chunk is sent. Speaking Editor does not intentionally send file paths, vault names, note titles, API keys, or editor metadata to TTS providers.

## API Keys

The premium provider (ElevenLabs) needs an API key. Keys are stored per device in the Obsidian app's `localStorage`, under a namespaced key (`speaking-editor:key:<provider>`).

- Keys are never written to the plugin's `data.json`, so a synced vault never carries a secret.
- Keys are never synced by Obsidian Sync or any vault sync, never logged, and never committed by the plugin.
- Keys are entered through a password field in settings and are never rendered back as readable text.

`localStorage` is per device and is not an operating system keychain. Speaking Editor does not claim to store keys in macOS Keychain, Windows Credential Manager, or a Linux keyring. If you clear the Obsidian app's local data on a device, the saved key on that device is removed.

## Audio Cache

Speaking Editor stores generated audio chunks in a per-device cache directory outside your vault, so cached audio is never synced with your notes:

| OS | Cache location |
|---|---|
| macOS | `~/Library/Caches/speaking-editor` |
| Linux and others | `$XDG_CACHE_HOME/speaking-editor`, or `~/.cache/speaking-editor` if `XDG_CACHE_HOME` is not set |

The cache is limited by the "Audio cache size" setting (default 200 MB) and can be cleared at any time from settings. Cached audio may contain spoken versions of text you asked the plugin to read. The location is shown in the settings tab, and clearing it removes only Speaking Editor's own cache files.

## Reading Position

Speaking Editor remembers where you stopped in each note so it can offer resume-on-play. That position (a word index per note) is stored in the plugin's `data.json` inside your vault and expires after 12 hours. It is note position only, never note content, and never an API key. Because it lives in `data.json`, a synced vault will sync your reading positions along with your notes.

## Telemetry

Speaking Editor does not collect or send analytics events. If telemetry is ever added in the future, it should be opt-in and documented here before release.

## User Responsibility

Do not use a network TTS provider for notes that you are not allowed to send to that provider. This includes confidential work notes, private client data, regulated data, or third-party copyrighted content where transmission to a cloud service is not permitted. On macOS, the `say` provider keeps everything on your machine.

For broader warranty, liability, provider, content-rights, and acceptable-use disclaimers, see [DISCLAIMER.md](DISCLAIMER.md).

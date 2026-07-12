# Third-Party Notices

Speaking Editor is licensed under MIT. This file records the third-party code it builds on: the vendored engine it started from, the runtime dependencies bundled into the packaged plugin, and the host APIs it compiles against but does not bundle.

## Vendored Engine (TalkToMeBaby)

Speaking Editor's engine (`src/engine/`) and playback brain (`src/playback/`) were vendored on 2026-07-12 from TalkToMeBaby (MIT, same author), then evolved in this repo. TalkToMeBaby is the read-aloud extension whose provider layer, timing normalizer, voice cache, disk cache, and playback plumbing this plugin reuses. See [VENDOR.md](VENDOR.md) for exactly what was copied, what changed, and what was deliberately left behind. The plan is to extract the shared engine into a standalone MIT package once the APIs settle.

TalkToMeBaby is Copyright (c) Rishabh Madaan, MIT licensed.

## Bundled Runtime Dependencies

The production build (`node build.mjs --prod`) bundles the plugin's one runtime dependency, `msedge-tts`, together with its transitive dependencies, into `dist/main.js`. Copyright belongs to the respective package authors and contributors. The bundled license set is permissive: MIT, ISC, and BSD-3-Clause.

| Package | Version | License |
|---|---:|---|
| agent-base | 6.0.2 | MIT |
| asynckit | 0.4.0 | MIT |
| axios | 1.18.1 | MIT |
| base64-js | 1.5.1 | MIT |
| buffer | 6.0.3 | MIT |
| call-bind-apply-helpers | 1.0.2 | MIT |
| combined-stream | 1.0.8 | MIT |
| debug | 4.4.3 | MIT |
| delayed-stream | 1.0.0 | MIT |
| dunder-proto | 1.0.1 | MIT |
| es-define-property | 1.0.1 | MIT |
| es-errors | 1.3.0 | MIT |
| es-object-atoms | 1.1.2 | MIT |
| es-set-tostringtag | 2.1.0 | MIT |
| follow-redirects | 1.16.0 | MIT |
| form-data | 4.0.6 | MIT |
| function-bind | 1.1.2 | MIT |
| get-intrinsic | 1.3.0 | MIT |
| get-proto | 1.0.1 | MIT |
| gopd | 1.2.0 | MIT |
| has-symbols | 1.1.0 | MIT |
| has-tostringtag | 1.0.2 | MIT |
| hasown | 2.0.4 | MIT |
| https-proxy-agent | 5.0.1 | MIT |
| ieee754 | 1.2.1 | BSD-3-Clause |
| inherits | 2.0.4 | ISC |
| isomorphic-ws | 5.0.0 | MIT |
| math-intrinsics | 1.1.0 | MIT |
| mime-db | 1.52.0 | MIT |
| mime-types | 2.1.35 | MIT |
| ms | 2.1.3 | MIT |
| msedge-tts | 2.0.7 | MIT |
| proxy-from-env | 2.1.0 | MIT |
| readable-stream | 3.6.2 | MIT |
| safe-buffer | 5.2.1 | MIT |
| stream-browserify | 3.0.0 | MIT |
| string_decoder | 1.3.0 | MIT |
| util-deprecate | 1.0.2 | MIT |
| ws | 8.21.0 | MIT |

## Host APIs (Compiled Against, Not Bundled)

The following are provided by the Obsidian runtime and are marked `external` in the build, so they are never bundled into `dist/main.js`. They are listed for attribution only.

| API | Role | License |
|---|---|---|
| `obsidian` | Obsidian plugin API (types and runtime, provided by the app) | Obsidian's Developer Terms |
| `@codemirror/state`, `@codemirror/view` | CodeMirror 6, the editor Obsidian is built on; the live-preview highlighting and click-to-seek register as CodeMirror editor extensions. Obsidian provides the live copy at runtime, so the plugin never bundles a second one. | MIT |
| `electron` | Desktop runtime Obsidian runs on | MIT |

macOS voices are produced by Apple's built-in `say` command, invoked locally. ElevenLabs and Edge TTS are network services reached over their own endpoints; see [PRIVACY.md](PRIVACY.md) and [DISCLAIMER.md](DISCLAIMER.md).

## MIT License Text

Permission is hereby granted, free of charge, to any person obtaining a copy of the applicable software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## ISC License Text

Permission to use, copy, modify, and/or distribute the applicable software for any purpose with or without fee is hereby granted, provided that the copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA, OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE, OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## BSD-3-Clause License Text

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of contributors may be used to endorse or promote products derived from the applicable software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES, INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION, HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT, INCLUDING NEGLIGENCE OR OTHERWISE, ARISING IN ANY WAY OUT OF THE USE OF THE APPLICABLE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

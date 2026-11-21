# BiliBili Learning Version

This project is an experimental Windows desktop learning client. It keeps the
information architecture of a modern video website while filtering Bilibili
recommendation candidates through an explainable, local learning classifier.

## Current MVP

- Bilibili recommendation candidate adapter with local fallback
- Local learning relevance scoring, ad-card filtering, subject routing and feedback
- Bundled local semantic subject classifier that runs in a Web Worker
- Official Bilibili login page in an isolated Electron session
- Chinese and English UI
- Persisted dark and light themes with an animated title-bar toggle
- HarmonyOS Sans bundled as the default interface font
- Standalone in-app DASH player with quality switching and synchronized audio
- Per-video danmaku overlay with an independent visibility toggle
- Multi-part and UGC-season course overview with in-player episode switching
- Hot-sorted video comments with like counts and expandable reply threads
- Background playback that continues when the app is minimized or loses focus
- Importable learning-list repositories hosted on public GitHub repositories
- Search, player view, local notes and persisted preferences

## Run

```powershell
pnpm install
pnpm dev
```

Build and verify:

```powershell
pnpm check
```

Create a Windows NSIS installer:

```powershell
pnpm package:win
```

Build output is written to `release-artifacts/`. The legacy `release/`
directory contains old unpacked development builds and should not be
distributed.

Build an unpacked application for local smoke testing:

```powershell
pnpm package:dir
```

## Automatic updates

The installed application checks GitHub Releases at startup and also exposes a
manual check in **Settings → Software updates**. Updates use the standard
electron-builder NSIS updater, download `latest.yml` and the differential
installer, and restart through the installer after confirmation.

The release repository is embedded at build time. Local builds without release
configuration keep the update UI disabled. To bind a local build to a GitHub
repository:

```powershell
$env:BILIBILI_LEARNING_UPDATE_REPOSITORY = "owner/BiliBili-Learning-Version"
pnpm package:win
```

For GitHub Actions, `.github/workflows/release.yml` reads
`GITHUB_REPOSITORY` automatically. Pushing a tag such as `v0.2.0` builds and
publishes the installer, block map and `latest.yml` to the matching GitHub
Release. The repository owner must enable GitHub Actions write permission for
the workflow.

## Login and content-source note

The login window opens Bilibili's official passport page and keeps its cookies
in an isolated Electron session. No password is read by the application. This MVP is
a personal-use integration experiment. Public distribution of an unofficial
Bilibili client, automated content retrieval, ad removal or subtitle
redistribution should be reviewed against Bilibili's current platform terms and
requires an appropriate official partnership or permission.

The recommendation adapter is intentionally isolated in
`electron/main.cjs`. Official partner feed access can replace the current
adapter without changing the learning classifier or interface.

## Subtitle recognition

The player loads subtitle tracks already supplied for a video. The next step is
local OCR/ASR for videos without a track. It is not represented as working in
this MVP.

Playback uses the streams returned for the currently authenticated Bilibili
session. Paid, member-only or otherwise unavailable streams are not bypassed.

## Local semantic classifier

The app bundles `BAAI/bge-small-zh-v1.5`, converted to an INT8 ONNX model, and
uses Transformers.js with ONNX Runtime Web. Classification runs entirely in a
background Web Worker; recommendation metadata is not sent to a model API.
Keyword and term-frequency results remain the fallback if the model cannot
load. Model provenance and licensing are documented in
[MODEL-NOTICE.md](MODEL-NOTICE.md).

## Learning-list repositories

Open **Learning lists** and add a public GitHub repository URL. The importer
looks for `.bilibili-learning.json`, `learning-list.json`,
`bilibili-learning.json` or `study-list.json`. Directory and direct JSON links
are also supported.

See [examples/learning-list.json](examples/learning-list.json) for the current
schema. A lesson may use either a `bvid` or a Bilibili video `url`. Course
sections use a `lessons` array; `videos` and `items` are accepted as aliases.

Learning lists can also be loaded without GitHub. Choose **Load local JSON** or
drag a JSON manifest onto the import form. The normalized list, course
structure, part selection and segment rules are stored locally and remain
available after restarting the app without a network connection. Video streams
are not downloaded by this feature, so actual playback still depends on whether
the corresponding Bilibili stream is reachable.

Imported lists are limited to 5 MB. Existing learning data is migrated
automatically from localStorage into the application data directory on first
launch.

Each lesson can target a specific part with `cid` and `page`. Set
`inclusion: "full"` for the complete part, or `inclusion: "segments"` with a
`segments` array to play only selected ranges:

```json
{
  "title": "重点片段",
  "bvid": "BV1xxxxxxxxx",
  "cid": 41584887295,
  "page": 1,
  "inclusion": "segments",
  "segments": [
    { "start": 32.5, "end": 184.2, "title": "背景介绍" },
    { "start": 245, "end": 510.8, "title": "表达讲解" }
  ]
}
```

When a video is opened from an imported learning list, the player skips ranges
outside the configured segments. The playbar exposes a segment-mode toggle so
the viewer can temporarily watch the complete video.

## Creator mode

Open **Learning lists** and choose **Open creator mode**, or use the persistent
**Learn / Create** switch in the title bar. Creator mode is a workspace inside
the main window, not a child window or standalone product. Switching to it
hides the left navigation sidebars and keeps only the title bar, global search,
and creator workspace visible.

The main area shows raw Bilibili search results, the selected video, its normal
series/part overview, and the list rules below it. A video can be added as a
complete part or as selected time ranges. For series videos, the current video,
the complete series, or an individually checked subset can be added.

Included videos appear in a per-video manager on the right. Each row shows
whether the video is complete or segmented, summarizes its time ranges, and can
be expanded to edit that video's own ranges. Adding several videos at once
starts new videos as full videos and preserves existing per-video segment rules;
batch range changes remain available as an explicit advanced action. JSON can
still be imported, exported, and published, but the fixed JSON preview panel has
been removed from the creator UI.

Segment editing uses a timeline scaled to the real duration of the selected
video part. Drag on an empty part of the timeline to create a range, drag the
middle of a range to move it, and drag either edge to resize it. Exact start and
end seconds remain editable below the timeline.

GitHub authentication uses a Personal Access Token with repository write
permission. The token is encrypted with Electron `safeStorage` and is never
included in the exported learning list.

## Local data

Learning-list data, playback progress, history, favorites, watch time and course
notes are stored as atomically updated records under Electron's `userData`
directory. Small display preferences remain in localStorage. Each data record
has a backup file beside its primary file and is subject to size and schema
limits.

## HarmonyOS Sans

HarmonyOS Sans is bundled unmodified through
`harmonyos-sans-sc-webfont-splitted`. See the package and its bundled license
metadata for the current font license terms.

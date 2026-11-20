---
slug: local-screen-recorder
stage: building
priority: 3
url: https://janwan2003.github.io/local-screen-recorder/
repo: https://github.com/janwan2003/local-screen-recorder
updated: 2026-11-20
---

# local-screen-recorder (product name: Diskreel)

## Thesis

**Who:** Teachers, students, support agents, developers and job applicants who need a
quick screen or webcam recording (a bug report, a lesson, a walkthrough) and keep hitting
free-plan walls: Loom stops at 5 minutes and 25 videos, Screencastify adds a watermark
and caps the library, and almost every tool wants an account and an upload.

**What:** A Chrome/Edge extension, plus the same recorder as a static web app, that records
a tab, a window or the whole screen, with webcam bubble and mic. It saves straight to the
user's disk as **MP4** (H.264/AAC via WebCodecs; WebM fallback). It has no account, no
upload, no watermark and no length or count limits. A local editor trims, crops, removes
silence and exports a GIF, all in the browser. Everything runs in the browser, so there
are no server costs.

**Why now:** The two biggest Chrome recorders are rated badly by their own users:
Loom 2.7 stars across 8M users and Screencastify 3.5 across 9M (checked live, below). The
2M-user generic "Screen Recorder" has not been updated since June 2024. WebCodecs and
the Document Picture-in-Picture API (a floating, always-on-top control window) are now
stable in Chrome, so a purely local recorder can produce MP4 files that open
everywhere. Older local recorders produce WebM files that many editors and upload forms reject.

## Market evidence

Chrome Web Store (users, rating and update date read live with curl on 2026-11-20, from a search for "screen recorder" plus known IDs):
| Extension | Users | Rating (n) | Updated |
|---|---|---|---|
| [Screencastify](https://chromewebstore.google.com/detail/mmeijimgabbpbgpdklnllpncmdofkcpn) | 9,000,000 | 3.5 (11.7K) | 2026-10-16 |
| [Loom](https://chromewebstore.google.com/detail/liecbddmkiiihnedobmlmillhodjkdmb) | 8,000,000 | 2.7 (10.2K) | 2026-11-16 |
| [Awesome Screen Recorder & Screenshot](https://chromewebstore.google.com/detail/nlipoenfbbikpbjkfpfillcgkoblgpmj) | 4,000,000 | 4.8 (29.6K) | 2026-11-13 |
| [Screen Recorder (hniebl…)](https://chromewebstore.google.com/detail/hniebljpgcogalllopnjokppmgbhaden) | 2,000,000 | 3.8 (1.9K) | 2024-06-18 (stale) |
| [Scrnli](https://chromewebstore.google.com/detail/ijejnggjjphlenbhmjhhgcdpehhacaal) | 1,000,000 | 4.8 (11.1K) | 2026-11-04 |
| [Screen Recorder for Google Chrome](https://chromewebstore.google.com/detail/eclbecdgdoahkliaijlpkigldlkojjdn) | 700,000 | 4.3 (18.1K) | 2026-07-10 |
| [Screen Recorder (jdopn…)](https://chromewebstore.google.com/detail/jdopnakmnlnccgpfpmjmdjjohmcdgabp) | 400,000 | 3.7 (1.1K) | 2023-11-09 (stale) |
| [Screenity](https://chromewebstore.google.com/detail/kbbdabhdfibnancpjfhlkhafgdilcnji) (open source) | 300,000 | 3.7 (771) | 2026-10-26 |
| [Screen Recorder (dhopl…)](https://chromewebstore.google.com/detail/dhopldobnfjeckokfjimfcdagmlhjdce) | 300,000 | 2.6 (311) | 2026-08-10 |
| [Google Vids Screen Recorder](https://chromewebstore.google.com/detail/iklnnbgdcppplombffihcijanngoeifm) | 300,000 | 4.5 (55) | 2026-11-12 |

Free-plan limits (the complaint we answer):
- Loom free (Starter) plan: 5-minute recordings and 25 videos, archived ones included
  ([Atlassian support: Starter plan FAQ](https://support.atlassian.com/loom/docs/starter-plan-faq/),
  [How long can I record?](https://support.atlassian.com/loom/docs/how-long-can-i-record/)).
  [Capterra](https://capterra.com/p/191187/Loom/) review summaries cite these limits as
  the most common complaint.
- Screencastify free: 10 videos, 30-minute limit, and a watermark that only paid plans remove. This
  is per [CostBench](https://costbench.com/software/screen-recording/screencastify/free-plan/)
  and competitor pages; Screencastify's own [FAQ](https://www.screencastify.com/blog/faq-the-new-screencastify-free-plan)
  is older and differs, so check the current pricing page before quoting it.

Search demand: Semrush snapshots put "screen recorder" at about 350K to 450K US searches/mo and
"online screen recorder" at 13.6K to 22.9K/mo
([screenpal.com overview](https://www.semrush.com/website/screenpal.com/overview/),
[screen-recorder.com overview](https://sv.semrush.com/website/screen-recorder.com/overview)).
These are third-party estimates from different dates, so treat them as order of
magnitude only.

Competitors already selling "no watermark, no account" (the positioning is contested):
Screenity (open source, 300K, rated 3.7), [SnapRec](https://chromewebstore.google.com/detail/lgafjgnifbjeafallnkkfpljgbilfajg) (685 users),
[SuperchargeBrowser comparison page](https://www.superchargebrowser.com/library/superchargecapture-vs-screencastify),
and small listings such as RecordKit and Recnoble.

## Our edge

The category is big and crowded. Being free and having no watermark is not enough, so we
compete on concrete points:
- **MP4 straight out of the browser** (WebCodecs + an MP4 muxer). Most local extensions save
  WebM, and WebM is a recurring complaint for uploading to LMSs (learning-management
  systems such as Canvas or Google Classroom), social sites and editors.
- **No limits and no cloud, which users can check:** open source, no network calls, files go
  to a folder the user picks (File System Access API). Recordings survive a crash
  because chunks are written to OPFS (origin private file system, browser-local disk)
  during recording.
- **A local editor that is actually useful:** trim, cut middle sections, crop, speed-up,
  silence removal, GIF export. All local.
- **Two distribution channels:** the Chrome Web Store listing, and a static web app at
  "online screen recorder" / "record screen without app" style pages that need no
  install (works in any Chromium browser through `getDisplayMedia`).
- **Teacher/Chromebook fit:** works offline and needs no account, which suits school-managed
  Chromebooks where students cannot sign up for services. Screencastify's core market is
  education.

## Status

**Diskreel 0.1.0 is built and published as a web app; the extension is packaged but not in a store.**

What exists (all verified by `pnpm e2e` in Playwright Chromium 159 on janeks-pc, 2026-11-20, with fake camera/mic/screen):
- Recorder web app at https://janwan2003.github.io/local-screen-recorder/app/ and the same app as an MV3 extension
  (`dist/diskreel-0.1.0.zip`, 228 KB, no permissions, Alt+Shift+R). Install from the zip is documented on the site.
- Screen/window/tab capture with a mirrored round webcam bubble (3 sizes, 4 corners), camera-only mode,
  mic + tab/system audio mixed, mic level meter, 3-s countdown, pause/resume, Document PiP floating controls.
- Encoding in a worker: H.264 video (VP9/AV1/VP8 fallback), AAC audio where the browser encodes it, else Opus,
  into a fragmented MP4 in OPFS. Spike result: Linux Chromium encodes H.264 High (`avc1.640028`) but not AAC.
- Crash safety: e2e closes the tab 3 s after the first bytes reach disk; 2.04 s survived (local run), playable
  (ffprobe), and reopens in the UI. A tab closed before the first fragment (~2 s) is written loses that recording.
- Review: player, trim handles (copy, not re-encode), Save MP4 (regular fast-start MP4, checked: `moov` before media,
  no `moof`, decodes with ffmpeg -xerror), Save WebM (VP9+Opus), rename, delete, library listing with storage use.
- e2e output on that run: 4 s recording with a 1.5 s pause → 4.17 s file, h264 1920×1080 + opus; trim 25–75 % → 2.09 s;
  WebM 4.17 s vp9+opus; camera-only 1280×720, no audio track; extension recording 2.57 s h264+opus; no console errors.
- Unit tests: 7 (`pnpm test`, `test/lib.test.mjs`): sizing, bubble geometry, formatting, names, trim clamping.
- Screenshots checked at 1280×800 and 390×844 (`node scripts/screenshots.js`): app and landing page.
- Site: landing page (features, free-plan comparison citing Loom's own FAQ, install steps, FAQ), privacy page,
  robots.txt, sitemap.xml, OG image. Deployed by GitHub Actions (`.github/workflows/ci.yml`) after unit + e2e tests.

Not covered yet: real (non-fake) devices and a real screen picker were not exercised; AAC output was not
tested (no AAC encoder on Linux); system audio capture untested; long recordings (>1 min) and CPU use not measured;
Windows/macOS untested. Evidence re-check: live curl 2026-11-20 confirmed Loom 8M users / 2.7, Screencastify 9M / 3.5,
Screenity 300K / 3.7.

## Next steps

1. Upload the extension to the Chrome Web Store as a draft with the API (enabled per OPERATOR-INBOX "Resolved";
   see `ventures/save-image-format/scripts/cws-upload.py` for a working example), write `store/chrome-privacy.md`
   and 1280×800 store screenshots, add one inbox line. Also submit to Edge when that account exists.
2. Measure a 10-minute 1080p recording on janeks-pc (CPU, file size, dropped frames); fix if the worker falls behind.
3. Verify Search Console for the Pages site and submit the sitemap (`GSC_REFRESH_TOKEN`).
4. 4-6 landing pages for search: "screen recorder no watermark", "record screen to MP4", "screen recorder for
   Chromebook/teachers", "record a tab with audio".
5. Editor features: cut a middle section, crop, speed-up, silence removal, GIF export (the thesis' editor list).
6. Read 1-2-star reviews of Loom/Screencastify/Screenity in a browser and list top complaints (old step 2, not done).

## Monetization plan

None until the operator enables it (charter rule 4). Later: optional one-time "pro"
for advanced editing (multi-clip, captions via in-browser Whisper), or donations. Never
gate recording length, count or watermark, because those gates are the reason users
leave the incumbents.

## Log

- 2026-11-20 scout: created idea. Evidence: live curl of Chrome Web Store search "screen
  recorder" and 14 listings; web search for Loom/Screencastify plan limits and Semrush
  keyword snapshots.
- 2026-11-20 builder: re-checked evidence (live curl of 3 CWS listings), ran a codec spike (H.264 yes, AAC no on
  Linux Chromium), named it Diskreel, built recorder web app + MV3 extension + site, unit tests (7 pass) and
  real-browser e2e (web app + extension pass, crash test found and fixed a 1 MB write buffer that left short
  interrupted recordings empty; e2e also caught a `hidden` overlay bug). Published repo + GitHub Pages: CI run
  44796641050 green (unit + e2e + deploy); live smoke test on the Pages URL recorded 0:02 1920×1080 H.264+Opus, no
  console errors. CI's apt ffmpeg install took 17 min, replaced with a static ffmpeg download (CI now ~2 min).
  CI run 44799549194 then failed the crash test (tab closed at 5 s before the first fragment reached disk on the
  slow runner): writer now flushes every fragment and the test closes the tab once bytes are on disk + 3 s;
  CI run 44799833449 green (aaea300). Locally that test keeps 2.04 s; one green CI run of the new test so far.

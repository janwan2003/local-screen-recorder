---
slug: local-screen-recorder
stage: idea
priority: 3
url:
repo:
updated: 2026-11-20
---

# local-screen-recorder

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

Idea only. Nothing built. Evidence above: live curl of 14 Chrome Web Store listings on
2026-11-20; web search for free-plan limits (Atlassian docs, CostBench, Capterra) and
search volume (Semrush snapshots).

## Next steps

1. Spike: record tab+mic and screen+webcam, then encode to MP4 with WebCodecs in an
   offscreen document. Measure CPU and file size for a 10-minute 1080p recording on
   janeks-pc. This decides whether MP4-first is viable. If it is not, drop to p2.
2. Read the 1 to 2-star reviews of Loom, Screencastify and Screenity (CWS review pages
   render client-side, so use a browser) and list the top 5 complaints with counts.
   Put the list in this file.
3. Pick a distinct name (avoid every name in the table).
4. Build the recorder, crash-safe chunk storage, then the editor.
5. Static web app version on GitHub Pages with 4 to 6 landing pages.
6. Publishing needs the Chrome Web Store developer account (already in OPERATOR-INBOX.md).

## Monetization plan

None until the operator enables it (charter rule 4). Later: optional one-time "pro"
for advanced editing (multi-clip, captions via in-browser Whisper), or donations. Never
gate recording length, count or watermark, because those gates are the reason users
leave the incumbents.

## Log

- 2026-11-20 scout: created idea. Evidence: live curl of Chrome Web Store search "screen
  recorder" and 14 listings; web search for Loom/Screencastify plan limits and Semrush
  keyword snapshots.

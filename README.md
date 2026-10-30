# N95 News MPL Telugu — Angular 21 Website

**Brand:** N95 News MPL Telugu  
**Tagline:** అనుక్షణం ప్రజలపక్షం...  
**Coverage:** Madanapalle, Andhra Pradesh  
**YouTube channel:** https://www.youtube.com/channel/UChm8ZVGKr5RL3YZoxDkoSaA

## What is included

- Responsive, editorial Telugu news homepage for desktop, tablet, and phone.
- **The original user-supplied logo is unmodified**, stored at `public/assets/n95-original-logo.png`.
- Navy/white/light grey colour palette with strategic red highlights.
- Featured news video, latest news gallery, search, category filters, load more.
- YouTube privacy-enhanced embedded viewer, video sharing via WhatsApp.
- Clear empty state rather than made-up news stories before first sync.
- Automatic YouTube video feed import using public Atom feed (no API key) or optional YouTube Data API v3.
- Scheduled sync and deployment via GitHub Actions every four hours (subject to GitHub scheduling delays).
- GitHub Pages build with project-site base path and an SPA `404.html` fallback.

## 1. Requirements

- Node.js **22.12.0 or newer** within Node 22, or a compatible Node 20/24 version.
- npm and Git.
- Internet access for `npm install` and YouTube synchronization.

Angular 21 requires TypeScript 5.9.x; this project is preconfigured for it.

## 2. Run locally on Windows (PowerShell)

Extract the ZIP. Open PowerShell inside the `n95-news-angular21` directory:

```powershell
node -v
npm -v
npm install
npm start
```

Angular opens `http://localhost:4200/`. The site will display an informative no-videos state until it has synced the actual YouTube feed.

> Troubleshooting: If you see `Could not find '@angular/build:dev-server'`, check you are in the project root (where `package.json` is) and run `npm install` again. Use `npx ng serve` rather than depending on a global CLI installation.

## 3. Import real videos from N95 News

### Option A — Public feed, no API key (recommended first)

```powershell
npm run sync:youtube
npm start
```

This reads recent PUBLIC YouTube uploads and updates `public/data/videos.json`. This is a **Node.js build-time sync**, not a browser-side request. The public Atom feed often exposes only about 15 recent videos. The script merges successful syncs into a local 150-video archive, so regular scheduled runs gradually preserve history. If a video is deleted or made private, cached metadata may remain until removed manually. Video playback remains subject to YouTube availability and embeddability.

### Option B — YouTube Data API v3 (optional)

Enable the YouTube Data API v3 for your Google Cloud project and create an API key. To use the API locally:

```powershell
$env:YOUTUBE_API_KEY="YOUR_OWN_KEY"
npm run sync:youtube
Remove-Item Env:YOUTUBE_API_KEY
```

The API importer fetches the channel uploads playlist and up to the 50 newest uploads. It still embeds media from YouTube. **Never paste the API key into Angular TypeScript, HTML, or a committed `.env` file.**

To use it on GitHub, add an Actions repository secret named `YOUTUBE_API_KEY`. The scheduled workflow automatically uses the API when present; otherwise it uses the public Atom feed.

## 4. Deploy automatically with GitHub Pages

1. Create a GitHub repository, e.g. `n95-news-website`, and upload/push the CONTENTS of this folder to its `main` branch. Make sure `.github/workflows/deploy.yml` is included.
2. Run `npm install` locally first. Commit the generated `package-lock.json` for reproducible installs when possible. The workflow supports both cases.
3. In GitHub go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Go to **Actions → N95 News • Sync YouTube and Deploy → Run workflow** or push a commit to `main`.
5. After the workflow succeeds, visit `https://YOUR_USERNAME.github.io/n95-news-website/` (replace the names).
6. New videos are checked approximately every **4 hours** via scheduled GitHub Actions. GitHub may delay or disable scheduling for inactive repositories.

The workflow restores/saves the video archive using GitHub Actions cache so new videos are retained across scheduled runs even though `videos.json` is not committed back to the repository. Caches can expire or be deleted; preserving a permanent full archive would require a database or versioned storage. The workflow uses a computed `--base-href` to support a normal repository project site. If you later use a custom root domain, change the base href to `/` and configure the custom domain in GitHub Pages.

### About package-lock.json

This source ZIP does not contain a lockfile because the generation environment could not reach npm. The GitHub Actions workflow uses `npm install` when a lockfile is absent; after you run `npm install` locally, you can commit `package-lock.json` and subsequent workflows will use the more reproducible `npm ci`.

## 5. How automatic updates work

```text
New public video on N95 YouTube
             ↓
GitHub Actions schedule (every 4 hours)
             ↓
Node.js scripts/sync-youtube.mjs
             ↓
public/data/videos.json (new items + cached history)
             ↓
Angular production build
             ↓
Deploy new GitHub Pages website
             ↓
Site loads updated titles, thumbnails and videos
```

No Spring Boot backend is required for this first release. A CMS and backend can be added later for hand-written Telugu articles, admin accounts, contact forms and advertising.

## 6. Project structure

```text
n95-news-angular21/
├── .github/workflows/deploy.yml
├── public/
│   ├── assets/n95-original-logo.png
│   └── data/videos.json
├── scripts/
│   ├── sync-youtube.mjs
│   └── check-project.mjs
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   └── news.model.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── angular.json
├── package.json
├── tsconfig.json
└── tsconfig.app.json
```

## 7. Colour and accessibility decisions

| Role | HEX |
|---|---|
| Header text / primary navy | `#111A3A` |
| News red | `#BA1725` |
| Neutral background | `#F7F8FC` |
| Cards | `#FFFFFF` |
| Headlines | `#182336` |
| Secondary text | `#657087` |

The original logo red/navy colours are not altered. Strong contrast body text, semantic headings, keyboard-focus states, non-autoplaying videos, responsive cards, and reduced-motion preferences are included.

## 8. Limits and follow-up work

- This site **does not invent breaking headlines**. All video titles and thumbnails are imported from the channel.
- Categorization is best-effort keyword matching in Telugu and English. The editorial team should review and extend keywords for improved accuracy.
- Public YouTube feeds are not guaranteed real-time; Github Actions schedules can be delayed.
- No live TV broadcast is fabricated; actual live links can be enabled once a real stream exists.
- Add confirmed Instagram, news tip email, WhatsApp Business contact and legal/editorial policies after the channel owner provides them.
- A static site won't automatically create indexable per-video article pages; server-side/prerendered article routes can be added in phase two.
- This ZIP was statically checked; full npm/Angular build could not be run in the generation container because npm registry access was unavailable.

# N95 News MPL Telugu — UI/UX Implementation Specification

## Design intent

A lightweight modern-editorial news portal primarily for Telugu-speaking residents of Madanapalle using phones and shared WhatsApp links. The editorial priority is news clarity and accessible playback, rather than TV-channel style animation.

The logo file is the exact uploaded PNG. It must never be recoloured, cropped, vector-traced, redrawn, overlaid, or stretched. The website uses the original asset in the header, footer, and video-subscribe section.

## Visual foundations

| Token | Value | Reason |
|---|---|---|
| Primary navy | `#111A3A` | Readable headings, trust and structure |
| News/action red | `#BA1725` | Headlines, channel accents, key calls to action |
| Content text | `#182336` | Strong contrast on white |
| Background | `#F7F8FC` | Comfortable reading for long sessions |
| Cards | `#FFFFFF` | Familiar news publishing layout |
| Secondary text | `#657087` | Distinct but not faint |
| Dividers | `#E5E9F0` | Subtle spacing and boundaries |
| Telugu font | Noto Sans Telugu | Clear Telugu conjuncts and natural line height |
| English/UI font | Inter | Sharp metadata, date, tags, nav labels |

Avoid pale grey body headlines, red paragraphs, flashing banners, or all-caps Telugu headings. Use red sparingly for clicks and breaking-news labels; news stories are never labelled BREAKING unless the editorial team explicitly marks them as such.

## Responsiveness

- Desktop >= 1151px: max content width 1232px, spacious header, featured 2-column grid, 3-column video cards and 4-column topic tiles.
- Compact desktop/tablet 901–1150px: smaller nav, featured remains 2-column, video grid 2–3 columns depending on width.
- Tablet 621–900px: collapsible nav, one-column featured, two-column video cards and three-column categories.
- Mobile <= 620px: compact header with original logo, 4-tab bottom nav, scrollable category chips, stacked lead story and efficient side-by-side short video cards.
- Interactive elements have visible keyboard focus; reduced-motion users do not receive unnecessary animations.

## Information hierarchy (homepage)

1. Utility strip: region and current local date; official YouTube channel link.
2. Main navigation: original logo, channel name and tagline; simple tabs and subscribe CTA.
3. News update strap: static editorial positioning, never fabricated live breaking news.
4. Intro editorial masthead: Telugu identity and Madanapalle focus.
5. Lead report: most recent published YouTube upload plus four additional updates.
6. Latest news: searchable and categorized cards, load-more control.
7. Topic tiles: politics, civic issues, agriculture, education, sports and local news.
8. Subscribe CTA: watch on YouTube or subscribe via official channel URL.
9. About and footer: channel identity, coverage, original logo and links.

## Primary UX flows

### A. Viewer wants the latest Madanapalle story

Arrives on homepage → sees top story thumbnail + publish date → presses video → YouTube privacy-enhanced embedded player opens → closes player or opens video directly on YouTube.

### B. Viewer is interested in farmers' news

Scrolls to categories → selects Agriculture → latest news auto scrolls into view → filter updates the video grid → choose video or share via WhatsApp.

### C. Viewer wants to find an old report

Types keyword in Telugu or English into search → live client-side filtering across title and description → finds matching video → opens viewer. Cached archive currently stores at most 150 videos; full historical search is a future backend feature.

### D. No real news has been imported yet

Shows attractive editorial masthead and informative explanation, not random videos, dummy headlines, fake dates or stock news photographs. The user can visit the official channel while automated sync is being configured.

## Content and data model

```ts
interface NewsVideo {
  id: string;                 // Actual 11-character YouTube video ID
  title: string;              // Original YouTube title, no AI rewriting
  description: string;        // Truncated video description
  publishedAt: string;        // YouTube date ISO-8601
  thumbnail: string;          // YouTube provided or i.ytimg.com fallback
  url: string;                // Original watch URL
  category: 'local' | 'politics' | 'civic' | 'education' | 'agriculture' | 'sports' | 'other';
}
```

Classification currently uses simple keyword rules and may sometimes be wrong. A CMS later can let editors override tags and create regional subcategories. Dates are displayed with the Telugu/India locale on the website.

## Automatic publishing architecture

- Initial state: empty `public/data/videos.json`, no invented real-world news.
- `scripts/sync-youtube.mjs` reads the public YouTube Atom feed by default, or YouTube Data API v3 if the server-side secret `YOUTUBE_API_KEY` is configured.
- Each successful sync merges newly detected video IDs with the prior archive, deduplicates, sorts newest first, and retains the latest 150.
- GitHub Actions runs on push/manual trigger and a four-hour schedule, restoring cached video history between runs, then rebuilding and publishing Angular to GitHub Pages.
- Feed synchronization is **not guaranteed instantaneous**; scheduling and feed updates can be delayed. The browser doesn't call YouTube Data API directly and doesn't expose the API key.
- A failed sync leaves the prior archive unchanged; the deployment continues with available cached data.
- Production scaling can use Spring Boot + PostgreSQL + CMS when editorial articles, advanced search, direct contact, moderation, and advertising are introduced.

## Prioritized development milestones

- P0 — Source/UI: brand fidelity, Telugu type, desktop/mobile layouts, video browsing, 100% clear empty/error states.
- P0 — Automation: channel sync, deduplication, GitHub Actions deployment, correct project base href.
- P1 — Operational readiness: custom domain, news metadata, visual QA with real thumbnails, page load monitoring, sitemap, Google Search Console.
- P1 — Editorial controls: correction policy, contact details supplied by the channel owner, reporter list, manual category override, partner/ad policy.
- P2 — Backend: Spring Boot auth/admin, searchable database, article editor, scheduled jobs, moderation, push notifications, monetization.

## Launch acceptance checks

- [ ] Logo appears unmodified, same aspect ratio and original colors.
- [ ] Fresh Angular install succeeds with the required Node.js version.
- [ ] Every page section works on 360px, 390px, 768px, 1024px and 1440px widths.
- [ ] Search finds Telugu/English title content after sync.
- [ ] Category filter and reset both work.
- [ ] Modal shows a YouTube video only after a user click (no autoplay on arrival).
- [ ] WhatsApp share opens a prefilled link with correct watch URL.
- [ ] GitHub Pages site loads at `/REPO_NAME/` and images/JSON load correctly.
- [ ] New public YouTube video appears after a successful scheduled synchronization.
- [ ] Latest sync and upload timestamps are not confused with true live streaming.
- [ ] Dates and headings are legible to Telugu readers on mobile.
- [ ] Staff editorial review approves published categories and channel description.

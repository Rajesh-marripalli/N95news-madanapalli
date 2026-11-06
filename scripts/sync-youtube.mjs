/**
 * N95 News YouTube sync, designed for GitHub Actions.
 * Default: YouTube's public Atom feed (no credentials, usually ~15 recent posts).
 * Optional: YouTube Data API v3 with YOUTUBE_API_KEY, paginates the full uploads playlist.
 * Merges each successful fetch into a bounded local archive.
 * The browser NEVER receives the API key.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const CHANNEL_ID = 'UChm8ZVGKr5RL3YZoxDkoSaA';
const DATA_PATH = resolve('public/data/videos.json');
const VALID_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_ARCHIVE = Math.max(50, Math.min(2000, Number.parseInt(process.env.YOUTUBE_ARCHIVE_LIMIT || "500", 10) || 500));

function classify(title, description = '') {
  const text = `${title} ${description}`.toLocaleLowerCase();
  if (/రాజకీయ|ఎమ్మెల్యే|ఎంపీ\b|మంత్రి|ఎన్నిక|tdp|ysrcp|janasena|bjp|politic|chandrababu|పార్టీ|పవన్ కళ్యాణ్/.test(text)) return 'politics';
  if (/రోడ్డు|నీటి|విద్యుత్|మున్సిపల్|మురుగు|ట్రాఫిక్|పోలీస్|ప్రమాదం|ఆసుపత్రి|కలెక్టర్|municipal|traffic|accident|police|water supply|public issue/.test(text)) return 'civic';
  if (/విద్య|పాఠశాల|కాలేజీ|ఉద్యోగ|పరీక్ష|ఫలిత|school|college|student|exam|job|education/.test(text)) return 'education';
  if (/రైతు|వ్యవసాయ|పంట|సాగు|మార్కెట్|agricultur|farmer|crop|harvest/.test(text)) return 'agriculture';
  if (/క్రీడ|క్రికెట్|ఫుట్‌బాల్|sports|cricket|football|kabaddi/.test(text)) return 'sports';
  if (/మదనపల్లె|మదనపల్లి|madanapalle|madanapalli|local|చిత్తూరు|అన్నమయ్య|tirupati|పలమనేరు|పుంగనూరు/.test(text)) return 'local';
  return 'other';
}

function cleanVideo(id, title, description, publishedAt, thumbnail) {
  const videoId = String(id ?? '').trim();
  const safeTitle = String(title ?? '').trim();
  const published = new Date(String(publishedAt ?? ''));
  if (!VALID_ID.test(videoId) || !safeTitle || Number.isNaN(published.getTime())) return null;
  return {
    id: videoId,
    title: safeTitle,
    description: String(description ?? '').slice(0, 500),
    publishedAt: published.toISOString(),
    thumbnail: /^https:\/\//.test(String(thumbnail)) ? String(thumbnail) : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    category: classify(safeTitle, String(description ?? ''))
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`YouTube API returned HTTP ${response.status}`);
  return response.json();
}

async function fromDataApi(key) {
  const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  channelsUrl.search = new URLSearchParams({ part: 'contentDetails', id: CHANNEL_ID, key }).toString();
  const channels = await fetchJson(channelsUrl);
  const uploads = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('Channel uploads playlist not found. Check your YouTube API key.');
  const collected = [];
  let pageToken = '';
  const maxPages = Math.ceil(MAX_ARCHIVE / 50);
  for (let page = 0; page < maxPages; page++) {
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.search = new URLSearchParams({ part: 'snippet,contentDetails', playlistId: uploads, maxResults: '50', key, ...(pageToken ? {pageToken} : {}) }).toString();
    const playlist = await fetchJson(playlistUrl);
    collected.push(...(playlist.items ?? []));
    pageToken = playlist.nextPageToken || '';
    if (!pageToken) break;
  }
  console.log(`YouTube Data API returned ${collected.length} uploaded-video entries.`);
  return collected.map(item => {
    const snip = item.snippet ?? {};
    if (snip.title === 'Private video' || snip.title === 'Deleted video') return null;
    const videoId = item.contentDetails?.videoId ?? snip.resourceId?.videoId;
    const thumbnail = snip.thumbnails?.high?.url ?? snip.thumbnails?.medium?.url ?? snip.thumbnails?.default?.url;
    return cleanVideo(videoId, snip.title, snip.description, item.contentDetails?.videoPublishedAt ?? snip.publishedAt, thumbnail);
  }).filter(Boolean);
}

async function fromAtomFeed() {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'N95NewsWebsiteSync/1.0 (public YouTube channel feed)', Accept: 'application/atom+xml,application/xml,text/xml' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`YouTube public feed returned HTTP ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const document = parser.parse(xml);
  const entries = document?.feed?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
  return list.map(entry => {
    const group = entry['media:group'] ?? {};
    const thumbnail = group['media:thumbnail']?.['@_url'];
    return cleanVideo(entry['yt:videoId'], entry.title, group['media:description'] ?? '', entry.published, thumbnail);
  }).filter(Boolean);
}

async function run() {
  let existing = { channelId: CHANNEL_ID, source: 'awaiting-first-sync', lastSyncedAt: null, videos: [] };
  try { existing = JSON.parse(await readFile(DATA_PATH, 'utf8')); } catch { /* first run */ }
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const fetched = apiKey ? await fromDataApi(apiKey) : await fromAtomFeed();
  if (fetched.length === 0) throw new Error('YouTube returned no public videos; retained previous feed for safety.');
  const byId = new Map();
  for (const video of [...fetched, ...(existing.videos ?? [])]) {
    if (video?.id && VALID_ID.test(video.id) && !byId.has(video.id)) byId.set(video.id, video);
  }
  const videos = [...byId.values()]
    .filter(v => !Number.isNaN(new Date(v.publishedAt).getTime()))
    .sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_ARCHIVE);
  const result = {
    channelId: CHANNEL_ID,
    source: apiKey ? 'youtube-data-api-v3' : 'youtube-atom-feed',
    lastSyncedAt: new Date().toISOString(),
    videos
  };
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`✓ N95 News synced: fetched ${fetched.length}, archived ${videos.length}; source=${result.source}`);
}

run().catch(error => {
  console.error(`YouTube sync failed; existing videos.json was not modified. ${error.message}`);
  process.exitCode = 1;
});

/**
 * N95 News — summarize public YouTube videos directly from the spoken Telugu.
 * GitHub Actions/Node only. Never expose GEMINI_API_KEY in the Angular bundle.
 * Builds a durable article archive and backs off temporary failures, so one
 * troublesome video cannot prevent later videos from being summarized.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEWS_PATH = resolve('public/data/news.json');
const VIDEO_PATH = resolve('public/data/videos.json');
const CHANNEL_ID = 'UChm8ZVGKr5RL3YZoxDkoSaA';
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
const MAX_PER_RUN = Math.min(25, Math.max(1, parseInt(process.env.GEMINI_MAX_PER_RUN || '8', 10) || 8));
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const TELUGU = /[\u0C00-\u0C7F]/;
const SCHEMA = {
  type: 'object',
  properties: {
    speechVerified: { type: 'boolean', description: 'True only if the spoken audio or narration was actually understood' },
    headline: { type: 'string', description: 'Clear factual but interesting Telugu headline' },
    lead: { type: 'string', description: 'One-sentence engaging and factual Telugu preview, 15–30 words' },
    summary: { type: 'string', description: 'Detailed natural Telugu summary of the spoken report, approximately 180–240 words in three short paragraphs' },
    keyPoints: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Exactly three distinct facts from the spoken report' },
    location: { type: 'string', description: 'Location stated in the report, else empty string' }
  },
  required: ['speechVerified', 'headline', 'lead', 'summary', 'keyPoints', 'location']
};

export function buildGeminiRequest(video, model = MODEL) {
  if (!VIDEO_ID.test(video.id)) throw new Error('Invalid YouTube ID');
  const prompt = `You are the careful Telugu-language editor for N95 News MPL Telugu (Madanapalle).\n
Watch/listen to the attached PUBLIC YouTube news video in full. Only summarize the content actually spoken in the video; never guess content from the thumbnail, description or title. Write in natural, engaging, easy-to-read Telugu that draws a reader in WITHOUT clickbait, invented claims, sensational wording or political bias.\n
Return EXACTLY one JSON object with these fields:\n
speechVerified: false when audio is inaccessible, inaudible, no spoken report, or you could only use metadata. In that case, all text fields must be empty and keyPoints must be [].\n
headline: a specific, useful factual Telugu headline, ideally 7–14 words.\n
lead: one short interesting Telugu lead sentence (~15–30 words) capturing the most important development.\n
summary: a detailed journalistic summary in natural Telugu, approximately 180–240 words across three short paragraphs. Explain who, what, where and why only when each detail is stated in the audio. Cover the central event, important supporting details, and any response or next step actually mentioned. Keep it straightforward and readable without repeating the headline or lead.\n
keyPoints: exactly THREE different Telugu facts or clearly attributed statements, 1 sentence each; no generic bullet points.\n
location: actual location spoken, or an empty string.\n
Accuracy: No fictional names, dates, places, quotations, numbers, cause, legal guilt, political claims, official reactions or actions. Attribute allegations to speakers, without presenting them as established facts. If evidence is missing, omit it. Do not repeat the headline verbatim as lead. Every assertion must be traceable to the speech. Return only JSON.`;
  return {
    model,
    body: {
      contents: [{ role: 'user', parts: [
        { file_data: { file_uri: `https://www.youtube.com/watch?v=${video.id}` } },
        { text: prompt }
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SCHEMA }
    }
  };
}

export function parseGeminiResponse(payload) {
  const candidate = payload?.candidates?.[0];
  if (!candidate) throw new Error('No Gemini response candidate (video access or API limit may be the cause)');
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini response not complete: ${candidate.finishReason}`);
  }
  const text = (candidate.content?.parts ?? []).filter(part => typeof part.text === 'string')
    .map(part => part.text).join('').trim();
  if (!text) throw new Error('Gemini returned no summary text');
  return JSON.parse(text);
}

export function normalizeSummary(result, video, model = MODEL, now = new Date()) {
  if (result?.speechVerified !== true) throw new Error('Spoken audio not confirmed — no news article created');
  const headline = String(result?.headline ?? '').trim();
  const lead = String(result?.lead ?? '').trim();
  const summary = String(result?.summary ?? '').trim();
  const points = Array.isArray(result?.keyPoints) ? result.keyPoints.map(x => String(x).trim()).filter(Boolean) : [];
  if (headline.length < 12 || lead.length < 24 || summary.length < 200 || points.length !== 3 ||
      points.some(p => p.length < 12)) throw new Error('Incomplete or too-short article rejected');
  if (![headline, lead, summary, ...points].every(v => TELUGU.test(v))) {
    throw new Error('Telugu content is required in headline, lead, summary and every key point');
  }
  if (new Set(points).size !== points.length) throw new Error('Key points must be distinct');
  return {
    videoId: video.id,
    headline: headline.slice(0, 200),
    lead: lead.slice(0, 330),
    summary: summary.slice(0, 3000),
    keyPoints: points.map(p => p.slice(0, 320)),
    location: String(result.location ?? '').trim().slice(0, 120),
    generatedAt: now.toISOString(),
    model,
    status: 'ai_draft',
    source: 'gemini-youtube-video-understanding'
  };
}

/** Next runs can backfill other videos while problematic videos cool down. */
export function selectPendingVideos(videos, existing, failures, count, now = new Date()) {
  return videos.filter(v => VIDEO_ID.test(v?.id) && !existing.has(v.id) &&
    (!failures[v.id]?.nextRetryAt || new Date(failures[v.id].nextRetryAt) <= now)).slice(0, count);
}

export function nextFailure(previous, now = new Date()) {
  const attempts = (previous?.attempts ?? 0) + 1;
  const delayHours = Math.min(72, 4 * Math.pow(2, Math.min(5, attempts - 1)));
  return { attempts, nextRetryAt: new Date(now.getTime() + delayHours * 3600_000).toISOString() };
}

async function loadJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export async function summarizeVideo(video, key, fetchFn = fetch) {
  const {model, body} = buildGeminiRequest(video);
  const response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000)
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${responseText.slice(0, 150)}`);
  return normalizeSummary(parseGeminiResponse(JSON.parse(responseText)), video, model);
}

async function main() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.log('::warning::GEMINI_API_KEY not configured. No spoken-video summaries can be generated.');
    return;
  }
  const feed = await loadJson(VIDEO_PATH, {channelId: CHANNEL_ID, videos: []});
  const archive = await loadJson(NEWS_PATH, {channelId: CHANNEL_ID, generatedAt: null, articles: [], failures: {}});
  if (feed.channelId !== CHANNEL_ID || archive.channelId !== CHANNEL_ID) throw Error('Channel ID mismatch');
  const existing = new Map((archive.articles ?? []).filter(a => VIDEO_ID.test(a.videoId))
    .map(a => [a.videoId, a]));
  const failures = archive.failures && typeof archive.failures === 'object' ? {...archive.failures} : {};
  const pending = selectPendingVideos(feed.videos ?? [], existing, failures, MAX_PER_RUN);
  console.log(`Found ${feed.videos?.length ?? 0} videos, ${existing.size} summaries, ${pending.length} eligible for this run.`);
  if (!pending.length) return;
  let successes = 0;
  for (const video of pending) {
    try {
      const article = await summarizeVideo(video, key);
      existing.set(video.id, article);
      delete failures[video.id];
      successes++;
      console.log(`✓ Summarized spoken Telugu report ${video.id}`);
    } catch (error) {
      failures[video.id] = nextFailure(failures[video.id]);
      console.warn(`::warning::Summary deferred for ${video.id}: ${String(error.message).slice(0, 250)}`);
    }
  }
  const order = new Map((feed.videos ?? []).map((v, i) => [v.id, i]));
  const articles = [...existing.values()].sort((a, b) =>
    (order.get(a.videoId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.videoId) ?? Number.MAX_SAFE_INTEGER));
  const output = { channelId: CHANNEL_ID, generatedAt: new Date().toISOString(), articles, failures };
  await mkdir(dirname(NEWS_PATH), { recursive: true });
  await writeFile(NEWS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`✓ Created ${successes} new article(s). Total published AI drafts ${articles.length}. Remaining ${Math.max(0, (feed.videos?.length ?? 0) - articles.length)}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { console.error(`Summarizer failed: ${error.message}`); process.exitCode = 1; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, parseGeminiResponse, normalizeSummary, selectPendingVideos, nextFailure, summarizeVideo } from './summarize-news.mjs';

const video = { id: 'abcdefghijk', title: 'N95 VIDEO' };
const headline = 'మదనపల్లె పరిసరాల్లో స్థానికుల సమస్యలపై వచ్చిన ప్రధాన వార్త';
const lead = 'మదనపల్లె ప్రాంతంలో స్థానిక సమస్యలపై ప్రజలు వెల్లడించిన విషయాలను ఈ వీడియోలో ప్రస్తావించారు.';
const summary = 'మదనపల్లె పట్టణానికి సంబంధించిన స్థానిక సమస్యలపై ప్రజలు తమ అభిప్రాయాలను తెలిపినట్లు ఈ వీడియోలో పేర్కొన్నారు. సంబంధిత అంశాలను వార్తలో వివరించారు. స్థానికుల అభ్యర్థనలు, చర్చించిన సమస్యలు మరియు వారి స్పందన వంటి వివరాలను రిపోర్టులో వివరించిన మేరకు మాత్రమే ఈ కథనం అందిస్తుంది.';
const points = [
  'మదనపల్లెలో ఒక స్థానిక సమస్యను ప్రస్తావించారు.',
  'ప్రజలు సమస్యపై తమ అభిప్రాయాలను వెల్లడించారు.',
  'వీడియోలో సమస్యకు సంబంధించిన వివరాలను చెప్పారు.'
];
const output = {speechVerified: true, headline, lead, summary, keyPoints: points, location: 'మదనపల్లె'};
const response = {candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(output)}]}}]};

test('only attaches legitimate YouTube URL, asks model to use spoken content, requests JSON', () => {
  const req = buildGeminiRequest(video);
  assert.equal(req.body.contents[0].parts[0].file_data.file_uri, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.match(req.body.contents[0].parts[1].text, /spoken|audio/);
  assert.equal(req.body.generationConfig.responseMimeType, 'application/json');
  assert.throws(() => buildGeminiRequest({id: 'not-valid'}));
});
test('parses Gemini GenerateContent response', () => {
  assert.deepEqual(parseGeminiResponse(response), output);
  assert.throws(() => parseGeminiResponse({candidates: []}), /No Gemini response/);
  assert.throws(() => parseGeminiResponse({candidates: [{finishReason:'MAX_TOKENS'}]}), /not complete/);
});
test('rejects summaries that are not grounded in spoken audio', () => {
  assert.throws(() => normalizeSummary({...output, speechVerified: false}, video), /audio not confirmed/);
});
test('refuses generic or incomplete bullet points', () => {
  assert.throws(() => normalizeSummary({...output, keyPoints: [points[0], points[0], points[0]]}, video), /distinct/);
  assert.throws(() => normalizeSummary({...output, lead: 'short'}, video), /too-short/);
});
test('saves natural Telugu headline, lead, summary and three points', () => {
  const item = normalizeSummary(output, video, 'gemini-test', new Date('2026-10-30T00:00:00Z'));
  assert.equal(item.headline, headline);
  assert.equal(item.lead, lead);
  assert.equal(item.keyPoints.length, 3);
  assert.equal(item.status, 'ai_draft');
});
test('continues to older videos when recent failed video is cooling down', () => {
  const videos = [{id:'abcdefghijk'}, {id:'12345678901'}, {id:'12345678902'}];
  const failure = {'abcdefghijk': nextFailure(undefined, new Date('2026-10-30T00:00:00Z'))};
  const pending = selectPendingVideos(videos, new Map(), failure, 2, new Date('2026-10-30T00:01:00Z'));
  assert.deepEqual(pending.map(v => v.id), ['12345678901','12345678902']);
});
test('calls Google Gemini model with the YouTube video and interprets returned article', async () => {
  let seenUrl = '';
  const mockFetch = async (url, opts) => {
    seenUrl = url;
    assert.equal(opts.headers['x-goog-api-key'], 'test-key');
    assert.match(opts.body, /youtube.com/);
    return {ok: true, text: async () => JSON.stringify(response)};
  };
  const article = await summarizeVideo(video, 'test-key', mockFetch);
  assert.match(seenUrl, /:generateContent$/);
  assert.equal(article.videoId, video.id);
});

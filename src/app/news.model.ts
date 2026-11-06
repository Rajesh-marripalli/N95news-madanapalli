export type Category = 'all' | 'local' | 'politics' | 'civic' | 'education' | 'agriculture' | 'sports' | 'other';

export interface NewsVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
  category: Exclude<Category, 'all'>;
}

export interface NewsArticle {
  videoId: string;
  headline: string;
  lead?: string;
  summary: string;
  keyPoints: string[];
  location: string;
  generatedAt: string;
  model: string;
  status: 'ai_draft' | 'reviewed';
  source: string;
}

export interface NewsArticleFeed {
  channelId: string;
  generatedAt: string | null;
  articles: NewsArticle[];
}

export interface NewsFeed {
  channelId: string;
  source: string;
  lastSyncedAt: string | null;
  videos: NewsVideo[];
}

export interface NewsCategory {
  id: Category;
  label: string;
  icon: string;
}

export const CHANNEL_ID = 'UChm8ZVGKr5RL3YZoxDkoSaA';
export const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;
export const CATEGORIES: NewsCategory[] = [
  { id: 'all', label: 'అన్ని వార్తలు', icon: '▦' },
  { id: 'local', label: 'స్థానికం', icon: '⌖' },
  { id: 'politics', label: 'రాజకీయాలు', icon: '♜' },
  { id: 'civic', label: 'ప్రజా సమస్యలు', icon: '◎' },
  { id: 'education', label: 'విద్య & ఉద్యోగాలు', icon: '▤' },
  { id: 'agriculture', label: 'వ్యవసాయం', icon: '❀' },
  { id: 'sports', label: 'క్రీడలు', icon: '◈' },
  { id: 'other', label: 'ఇతర వార్తలు', icon: '◉' }
];

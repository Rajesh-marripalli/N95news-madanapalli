import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CHANNEL_URL, NewsArticle, NewsArticleFeed, NewsFeed, NewsVideo } from './news.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  readonly channelUrl = CHANNEL_URL;
  readonly currentYear = new Date().getFullYear();
  readonly today = new Intl.DateTimeFormat('te-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly feed = signal<NewsFeed | null>(null);
  readonly articleFeed = signal<NewsArticleFeed | null>(null);
  readonly selectedArticle = signal<NewsArticle | null>(null);
  readonly searchTerm = signal('');
  readonly onlyReadable = signal(false);
  readonly showCount = signal(9);
  readonly mobileMenuOpen = signal(false);
  readonly selectedVideo = signal<NewsVideo | null>(null);

  readonly videos = computed(() => this.feed()?.videos ?? []);
  readonly articlesByVideo = computed(() => new Map(
    (this.articleFeed()?.articles ?? []).map(article => [article.videoId, article])
  ));
  articleFor(video: NewsVideo): NewsArticle | undefined {
    return this.articlesByVideo().get(video.id);
  }
  readonly summarizedCount = computed(() => this.articlesByVideo().size);
  readonly featured = computed(() => this.videos()[0] ?? null);
  readonly matchingVideos = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.videos().filter(video => {
      const matchesReadable = !this.onlyReadable() || !!this.articleFor(video);
      const matchesQuery = !query || `${video.title} ${video.description} ${this.articleFor(video)?.headline ?? ''} ${this.articleFor(video)?.summary ?? ''}`.toLocaleLowerCase().includes(query);
      return matchesReadable && matchesQuery;
    });
  });
  readonly visibleVideos = computed(() => this.matchingVideos().slice(0, this.showCount()));
  readonly hasMore = computed(() => this.matchingVideos().length > this.showCount());
  readonly featuredEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.featured()?.id;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?rel=0`
    );
  });
  readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.selectedVideo()?.id;
    // Only valid YouTube IDs may be interpolated into an iframe URL.
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
    );
  });

  ngOnInit(): void {
    // Relative URL respects Angular's <base href> on GitHub Pages project sites.
    this.http.get<NewsArticleFeed>(`data/news.json?v=${Date.now()}`).subscribe({
      next: data => {
        const articles = Array.isArray(data.articles) ? data.articles.filter(a =>
          /^[A-Za-z0-9_-]{11}$/.test(a.videoId) &&
          typeof a.headline === 'string' &&
          typeof a.summary === 'string' &&
          Array.isArray(a.keyPoints)
        ) : [];
        this.articleFeed.set({ ...data, articles });
      },
      error: () => { /* Videos remain available if AI summary JSON is absent. */ }
    });
    this.http.get<NewsFeed>(`data/videos.json?v=${Date.now()}`).subscribe({
      next: data => {
        const videos = Array.isArray(data.videos)
          ? data.videos.filter(v => /^[A-Za-z0-9_-]{11}$/.test(v.id))
          : [];
        this.feed.set({ ...data, videos });
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }

  goTo(id: string): void {
    this.mobileMenuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    this.goTo('latest-news');
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.onlyReadable.set(false);
    this.showCount.set(9);
  }

  showMore(): void { this.showCount.update(n => n + 9); }

  openVideo(video: NewsVideo): void {
    if (/^[A-Za-z0-9_-]{11}$/.test(video.id)) this.selectedVideo.set(video);
  }

  closeVideo(): void { this.selectedVideo.set(null); }

  readArticle(video: NewsVideo): void {
    this.selectedArticle.set(this.articleFor(video) ?? null);
  }

  closeArticle(): void { this.selectedArticle.set(null); }

  videoForArticle(article: NewsArticle): NewsVideo | undefined {
    return this.videos().find(v => v.id === article.videoId);
  }

  watchFromArticle(article: NewsArticle): void {
    const video = this.videoForArticle(article);
    this.closeArticle();
    if (video) this.openVideo(video);
  }

  shareUrl(video: NewsVideo): string {
    const article = this.articleFor(video);
    const text = `${article?.headline || video.title}\n${article?.lead || ''}\n${video.url}\n— N95 News MPL Telugu`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('te-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }
}

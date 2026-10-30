import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CATEGORIES, Category, CHANNEL_URL, NewsFeed, NewsVideo } from './news.model';

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
  readonly categories = CATEGORIES;
  readonly currentYear = new Date().getFullYear();
  readonly today = new Intl.DateTimeFormat('te-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly feed = signal<NewsFeed | null>(null);
  readonly searchTerm = signal('');
  readonly activeCategory = signal<Category>('all');
  readonly showCount = signal(9);
  readonly mobileMenuOpen = signal(false);
  readonly selectedVideo = signal<NewsVideo | null>(null);

  readonly videos = computed(() => this.feed()?.videos ?? []);
  readonly featured = computed(() => this.videos()[0] ?? null);
  readonly highlights = computed(() => this.videos().slice(1, 5));
  readonly matchingVideos = computed(() => {
    const category = this.activeCategory();
    const query = this.searchTerm().trim().toLocaleLowerCase();
    return this.videos().filter(video => {
      const matchesCategory = category === 'all' || video.category === category;
      const matchesQuery = !query || `${video.title} ${video.description}`.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });
  readonly visibleVideos = computed(() => this.matchingVideos().slice(0, this.showCount()));
  readonly hasMore = computed(() => this.matchingVideos().length > this.showCount());
  readonly activeLabel = computed(() => this.categories.find(c => c.id === this.activeCategory())?.label ?? 'అన్ని వార్తలు');
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
    this.http.get<NewsFeed>('data/videos.json').subscribe({
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

  chooseCategory(category: Category, scroll = true): void {
    this.activeCategory.set(category);
    this.showCount.set(9);
    this.mobileMenuOpen.set(false);
    if (scroll) document.getElementById('latest-news')?.scrollIntoView({ behavior: 'smooth' });
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
    this.activeCategory.set('all');
    this.showCount.set(9);
  }

  showMore(): void { this.showCount.update(n => n + 9); }

  openVideo(video: NewsVideo): void {
    if (/^[A-Za-z0-9_-]{11}$/.test(video.id)) this.selectedVideo.set(video);
  }

  closeVideo(): void { this.selectedVideo.set(null); }

  shareUrl(video: NewsVideo): string {
    const text = `${video.title}\n${video.url}\n— N95 News MPL Telugu`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('te-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }
}

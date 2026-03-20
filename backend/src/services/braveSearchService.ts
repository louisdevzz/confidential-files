/**
 * Brave Search API service
 * Searches for real knowledge facts to make case scenarios more realistic.
 */

interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
}

interface BraveWebResult {
  title?: string;
  description?: string;
  url?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

export class BraveSearchService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor() {
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY ?? '';
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async search(query: string, count = 5): Promise<BraveSearchResult[]> {
    if (!this.isAvailable) return [];

    try {
      const params = new URLSearchParams({
        q: query,
        count: String(count),
        safesearch: 'strict',
        text_decorations: 'false',
      });

      const res = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as BraveSearchResponse;
      return (data.web?.results ?? [])
        .filter((r): r is Required<Pick<BraveWebResult, 'title' | 'description'>> & BraveWebResult =>
          Boolean(r.title && r.description)
        )
        .map((r) => ({
          title: r.title!,
          description: r.description!,
          url: r.url ?? '',
        }));
    } catch {
      // Search is optional — don't break case generation if it fails
      return [];
    }
  }

  /**
   * Search for knowledge facts relevant to a subject + difficulty level.
   * Returns a concise context string for the AI prompt.
   */
  async getKnowledgeContext(
    subject: string,
    subjectLabel: string,
    difficultyLabel: string
  ): Promise<string> {
    const queries: Record<string, string> = {
      math: `kiến thức toán học ${difficultyLabel} sai lầm phổ biến học sinh hay nhầm`,
      physics: `kiến thức vật lý ${difficultyLabel} hiểu lầm phổ biến học sinh hay sai`,
      chemistry: `kiến thức hóa học ${difficultyLabel} lỗi sai phổ biến học sinh hay mắc`,
      biology: `kiến thức sinh học ${difficultyLabel} sai lầm phổ biến học sinh hay nhầm`,
    };

    const query = queries[subject] ?? `kiến thức ${subjectLabel} ${difficultyLabel} sai lầm phổ biến`;
    const results = await this.search(query, 5);

    if (results.length === 0) return '';

    const snippets = results
      .slice(0, 3)
      .map((r) => `- ${r.title}: ${r.description}`)
      .join('\n');

    return (
      `\nTHÔNG TIN THAM KHẢO (từ tìm kiếm thực tế, dùng để tạo lỗi sai hợp lý):\n${snippets}\n` +
      `Hãy lấy cảm hứng từ những sai lầm thực tế này để tạo lỗi sai trong lời khai nghi phạm.\n`
    );
  }
}

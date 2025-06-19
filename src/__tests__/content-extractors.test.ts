import { describe, it, expect } from 'vitest';
import { FirecrawlContentExtractor } from '../integrations/content-extractors/firecrawl';
import { PlaywrightContentExtractor } from '../integrations/content-extractors/playwright';

describe('Content Extractors - Real Implementation Tests', () => {
  it('should initialize Firecrawl extractor', () => {
    const extractor = new FirecrawlContentExtractor({
      apiKey: 'test-key',
      includeMarkdown: true,
    });
    expect(extractor).toBeDefined();
  });
  
  it('should initialize Playwright extractor', () => {
    const extractor = new PlaywrightContentExtractor();
    expect(extractor).toBeDefined();
  });
  
  it('should handle missing API key for Firecrawl', () => {
    expect(() => {
      new FirecrawlContentExtractor({
        apiKey: '',
      });
    }).toThrow('Firecrawl API key is required');
  });
}); 
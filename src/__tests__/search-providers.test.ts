import { describe, it, expect } from 'vitest';
import { TavilySearchProvider } from '../integrations/search-providers/tavily';
import { SerperSearchProvider } from '../integrations/search-providers/serper';
import { AcademicSearchProvider } from '../integrations/search-providers/academic';
import { ExaSearchProvider } from '../integrations/search-providers/exa';
import { SerpAPISearchProvider } from '../integrations/search-providers/serpapi';

describe('Search Providers - Real Implementation Tests', () => {
  it('should initialize Tavily provider', () => {
    const provider = new TavilySearchProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
  
  it('should initialize Serper provider', () => {
    const provider = new SerperSearchProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
  
  it('should initialize Academic provider', () => {
    const provider = new AcademicSearchProvider({ semanticScholarApiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
  
  it('should initialize Exa provider', () => {
    const provider = new ExaSearchProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
  
  it('should initialize SerpAPI provider', () => {
    const provider = new SerpAPISearchProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
  
  it('should handle missing API key gracefully', () => {
    // Academic provider works without API key (falls back to public access)
    const provider = new AcademicSearchProvider({});
    expect(provider).toBeDefined();
  });
}); 
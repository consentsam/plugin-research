import { elizaLogger } from '@elizaos/core';
import { SearchResult } from '../../types';

export class StagehandGoogleSearchProvider {
  public readonly name = 'StagehandGoogle';
  
  constructor(private stagehandService: any) {}
  
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[StagehandGoogle] Searching for: ${query}`);
      
      // Get or create a Stagehand session
      const session = await this.stagehandService.getCurrentSession() || 
                     await this.stagehandService.createSession(`search-${Date.now()}`);
      
      // Navigate to Google
      await session.page.goto('https://www.google.com', { waitUntil: 'networkidle' });
      
      // Accept cookies if needed (for EU users)
      try {
        await session.page.click('button#L2AGLb', { timeout: 2000 });
      } catch (e) {
        // Cookie banner might not be present
      }
      
      // Type search query
      await session.stagehand.act({
        action: 'type',
        selector: 'textarea[name="q"], input[name="q"]',
        text: query
      });
      
      // Submit search
      await session.page.keyboard.press('Enter');
      await session.page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Extract search results using Stagehand's AI extraction
      const searchResults = await session.stagehand.extract({
        instruction: `Extract the top ${maxResults} organic search results. 
                     For each result, get the title, URL, and snippet/description. 
                     Skip ads, "People also ask", and other non-organic results.`,
        schema: {
          results: [{
            title: 'string',
            url: 'string', 
            snippet: 'string'
          }]
        }
      });
      
      if (!searchResults.results || searchResults.results.length === 0) {
        // Fallback to manual extraction
        const results = await session.page.evaluate(() => {
          const items: any[] = [];
          const searchResults = document.querySelectorAll('div[data-async-context] > div');
          
          searchResults.forEach((result) => {
            const titleElement = result.querySelector('h3');
            const linkElement = result.querySelector('a[href]');
            const snippetElement = result.querySelector('span[style*="-webkit-line-clamp"]');
            
            if (titleElement && linkElement) {
              items.push({
                title: titleElement.textContent || '',
                url: linkElement.getAttribute('href') || '',
                snippet: snippetElement?.textContent || ''
              });
            }
          });
          
          return items;
        });
        
        elizaLogger.info(`[StagehandGoogle] Found ${results.length} results via DOM extraction`);
        return results.slice(0, maxResults);
      }
      
      elizaLogger.info(`[StagehandGoogle] Found ${searchResults.results.length} results via AI extraction`);
      return searchResults.results.slice(0, maxResults);
      
    } catch (error) {
      elizaLogger.error('[StagehandGoogle] Search error:', error);
      throw error;
    }
  }
} 
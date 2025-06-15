import { elizaLogger } from '@elizaos/core';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SearchResult } from '../../types';

export class DuckDuckGoSearchProvider {
  public readonly name = 'DuckDuckGo';
  
  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[DuckDuckGo] Searching for: ${query}`);
      
      // Use DuckDuckGo HTML endpoint
      const url = 'https://html.duckduckgo.com/html/';
      const response = await axios.post(url, `q=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });
      
      // Parse HTML with cheerio
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];
      
      // Select search result elements
      $('.result').each((index, element) => {
        if (results.length >= maxResults) return false;
        
        const $result = $(element);
        const $link = $result.find('.result__a');
        const $snippet = $result.find('.result__snippet');
        
        const url = $link.attr('href');
        const title = $link.text().trim();
        const snippet = $snippet.text().trim();
        
        if (url && title) {
          results.push({
            title,
            url,
            snippet: snippet || 'No description available',
          });
        }
      });
      
      elizaLogger.info(`[DuckDuckGo] Found ${results.length} results`);
      return results;
      
    } catch (error) {
      elizaLogger.error('[DuckDuckGo] Search error:', error);
      throw error;
    }
  }
} 
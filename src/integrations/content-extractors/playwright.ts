import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { elizaLogger } from '@elizaos/core';
import * as cheerio from 'cheerio';
import { ExtractedContent } from './firecrawl';

export interface PlaywrightConfig {
  headless?: boolean;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  userAgent?: string;
  viewport?: { width: number; height: number };
  blockResources?: string[]; // ['image', 'media', 'font']
  maxRetries?: number;
  enableJavaScript?: boolean;
  enableCookies?: boolean;
}

export class PlaywrightContentExtractor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly config: PlaywrightConfig;

  constructor(config: PlaywrightConfig = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      waitUntil: 'networkidle',
      viewport: { width: 1920, height: 1080 },
      blockResources: ['image', 'media', 'font'],
      maxRetries: 3,
      enableJavaScript: true,
      enableCookies: false,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      elizaLogger.info('[Playwright] Initializing browser');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
      
      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: this.config.viewport,
        javaScriptEnabled: this.config.enableJavaScript,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
      });
      
      // Block unnecessary resources to speed up loading
      if (this.config.blockResources && this.config.blockResources.length > 0) {
        await this.context.route('**/*', (route) => {
          const resourceType = route.request().resourceType();
          if (this.config.blockResources?.includes(resourceType)) {
            route.abort();
          } else {
            route.continue();
          }
        });
      }
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async extractContent(url: string, retryCount: number = 0): Promise<ExtractedContent | null> {
    const startTime = Date.now();
    let page: Page | null = null;
    
    try {
      await this.initialize();
      
      if (!this.context) {
        throw new Error('Browser context not initialized');
      }
      
      elizaLogger.info(`[Playwright] Extracting content from: ${url}`);
      
      page = await this.context.newPage();
      
      // Set additional headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: this.config.waitUntil,
        timeout: this.config.timeout,
      });
      
      // Wait for content to be visible
      await this.waitForContent(page);
      
      // Extract the content
      const content = await this.extractPageContent(page);
      
      const duration = Date.now() - startTime;
      elizaLogger.info(`[Playwright] Content extracted in ${duration}ms (${content.content.length} characters)`);
      
      return content;
    } catch (error) {
      const duration = Date.now() - startTime;
      elizaLogger.error(`[Playwright] Extraction error after ${duration}ms:`, error);
      
      // Retry logic
      if (retryCount < (this.config.maxRetries || 3)) {
        elizaLogger.info(`[Playwright] Retrying extraction (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.extractContent(url, retryCount + 1);
      }
      
      return null;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  private async waitForContent(page: Page): Promise<void> {
    try {
      // Wait for common content selectors
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '#content',
        '.content',
        '.post',
        '.entry-content',
      ];
      
      for (const selector of contentSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          break;
        } catch {
          // Continue to next selector
        }
      }
      
      // Additional wait for dynamic content
      await page.waitForTimeout(1000);
      
      // Scroll to load lazy-loaded content
      await page.evaluate(() => {
        // @ts-ignore - This runs in browser context
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(500);
      
      // Scroll back to top
      await page.evaluate(() => {
        // @ts-ignore - This runs in browser context
        window.scrollTo(0, 0);
      });
    } catch (error) {
      elizaLogger.warn('[Playwright] Could not wait for specific content selectors');
    }
  }

  private async extractPageContent(page: Page): Promise<ExtractedContent> {
    // Get the page HTML
    const html = await page.content();
    
    // Extract text content using Playwright's built-in methods
    const textContent = await page.evaluate(() => {
      // @ts-ignore - This entire function runs in browser context
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach((el: Element) => el.remove());
      
      // @ts-ignore - This runs in browser context
      const unwanted = document.querySelectorAll('nav, footer, aside, .sidebar, .advertisement, .ad');
      unwanted.forEach((el: Element) => el.remove());
      
      // Try to find main content areas
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '#content',
        '.content',
        '.post',
        '.entry-content',
        'body'
      ];
      
      for (const selector of contentSelectors) {
        // @ts-ignore - This runs in browser context
        const element = document.querySelector(selector);
        if (element) {
          // @ts-ignore - HTMLElement exists in browser context
          return (element as any).innerText || element.textContent || '';
        }
      }
      
      // @ts-ignore - This runs in browser context
      return document.body.innerText || document.body.textContent || '';
    });
    
    // Extract metadata
    // @ts-ignore - All page.evaluate functions run in browser context
    const metadata = await page.evaluate(() => {
      const getMetaContent = (name: string): string | undefined => {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return meta?.getAttribute('content') || undefined;
      };
      
      return {
        title: document.title,
        description: getMetaContent('description') || getMetaContent('og:description'),
        author: getMetaContent('author'),
        publishedTime: getMetaContent('article:published_time'),
        modifiedTime: getMetaContent('article:modified_time'),
        language: document.documentElement.lang || getMetaContent('language'),
        ogTitle: getMetaContent('og:title'),
        ogDescription: getMetaContent('og:description'),
        ogImage: getMetaContent('og:image'),
        ogUrl: getMetaContent('og:url'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        keywords: getMetaContent('keywords'),
      };
    });
    
    // Extract links
    // @ts-ignore - All page.evaluate functions run in browser context
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors)
        .map(a => (a as any).href)
        .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
    });
    
    // Extract images
    // @ts-ignore - All page.evaluate functions run in browser context
    const images = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src]');
      return Array.from(imgs)
        .map(img => (img as any).src)
        .filter(src => src && !src.includes('data:image'));
    });
    
    // Convert to markdown using cheerio
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, footer, aside, .sidebar, .advertisement, .ad').remove();
    
    // Convert to markdown-like format
    let markdown = '';
    
    // Process headings
    $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
      const level = parseInt(elem.tagName.charAt(1));
      const text = $(elem).text().trim();
      if (text) {
        markdown += '\n' + '#'.repeat(level) + ' ' + text + '\n\n';
      }
    });
    
    // Process paragraphs
    $('p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) {
        markdown += text + '\n\n';
      }
    });
    
    // Process lists
    $('ul, ol').each((_, elem) => {
      $(elem).find('li').each((index, li) => {
        const text = $(li).text().trim();
        if (text) {
          const bullet = elem.tagName === 'ol' ? `${index + 1}.` : '-';
          markdown += `${bullet} ${text}\n`;
        }
      });
      markdown += '\n';
    });
    
    // Process code blocks
    $('pre, code').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) {
        if (elem.tagName === 'pre') {
          markdown += '```\n' + text + '\n```\n\n';
        } else {
          markdown += '`' + text + '`';
        }
      }
    });
    
    // Process blockquotes
    $('blockquote').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) {
        markdown += '> ' + text.replace(/\n/g, '\n> ') + '\n\n';
      }
    });
    
    return {
      content: textContent.trim(),
      markdown: markdown.trim() || textContent.trim(),
      html: html,
      metadata: metadata,
      links: [...new Set(links)], // Remove duplicates
      images: [...new Set(images)], // Remove duplicates
    };
  }

  async extractBatch(urls: string[]): Promise<Map<string, ExtractedContent | null>> {
    elizaLogger.info(`[Playwright] Extracting content from ${urls.length} URLs`);
    
    const results = new Map<string, ExtractedContent | null>();
    
    // Process sequentially to avoid overwhelming the browser
    for (const url of urls) {
      try {
        const content = await this.extractContent(url);
        results.set(url, content);
      } catch (error) {
        elizaLogger.error(`[Playwright] Failed to extract ${url}:`, error);
        results.set(url, null);
      }
    }
    
    return results;
  }

  async screenshot(url: string, outputPath: string): Promise<boolean> {
    let page: Page | null = null;
    
    try {
      await this.initialize();
      
      if (!this.context) {
        throw new Error('Browser context not initialized');
      }
      
      page = await this.context.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });
      
      await page.screenshot({
        path: outputPath,
        fullPage: true,
      });
      
      elizaLogger.info(`[Playwright] Screenshot saved to ${outputPath}`);
      return true;
    } catch (error) {
      elizaLogger.error('[Playwright] Screenshot error:', error);
      return false;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  async pdf(url: string, outputPath: string): Promise<boolean> {
    let page: Page | null = null;
    
    try {
      await this.initialize();
      
      if (!this.context) {
        throw new Error('Browser context not initialized');
      }
      
      page = await this.context.newPage();
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });
      
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
      });
      
      elizaLogger.info(`[Playwright] PDF saved to ${outputPath}`);
      return true;
    } catch (error) {
      elizaLogger.error('[Playwright] PDF error:', error);
      return false;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
} 
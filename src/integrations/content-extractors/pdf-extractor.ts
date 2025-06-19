import { elizaLogger } from '@elizaos/core';
import axios from 'axios';
import { ExtractedContent } from './firecrawl';

// Dynamic import to avoid pdf-parse test code execution
let pdfParse: any;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch (error) {
      elizaLogger.warn('[PDFExtractor] pdf-parse not available, PDF extraction disabled');
    }
  }
  return pdfParse;
};

export interface PDFMetadata {
  title?: string;
  author?: string[];
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pages?: number;
}

export interface AcademicPaperStructure {
  abstract?: string;
  introduction?: string;
  methodology?: string;
  results?: string;
  discussion?: string;
  conclusion?: string;
  references?: Reference[];
  figures?: Figure[];
  tables?: Table[];
}

export interface Reference {
  id: string;
  text: string;
  authors?: string[];
  title?: string;
  year?: number;
  journal?: string;
  doi?: string;
  url?: string;
}

export interface Figure {
  id: string;
  caption: string;
  pageNumber: number;
  mentioned: string[];
}

export interface Table {
  id: string;
  caption: string;
  headers?: string[];
  rows?: string[][];
  pageNumber: number;
}

export class PDFExtractor {
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB limit

  async extractFromURL(url: string): Promise<ExtractedContent | null> {
    try {
      elizaLogger.info(`[PDFExtractor] Downloading PDF from: ${url}`);
      
      // Download PDF
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: this.maxFileSize,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ElizaOS/1.0)',
        },
      });
      
      const buffer = Buffer.from(response.data);
      return await this.extractFromBuffer(buffer, url);
    } catch (error) {
      elizaLogger.error('[PDFExtractor] Failed to download PDF:', error);
      return null;
    }
  }

  async extractFromBuffer(buffer: Buffer, sourceUrl?: string): Promise<ExtractedContent | null> {
    try {
      elizaLogger.info('[PDFExtractor] Parsing PDF buffer');
      
      const parser = await loadPdfParse();
      if (!parser) {
        elizaLogger.warn('[PDFExtractor] PDF parser not available');
        return null;
      }
      
      const data = await parser(buffer);
      
      // Extract metadata
      const metadata = this.extractMetadata(data.info);
      
      // Extract text content
      const text = data.text;
      
      // Extract academic structure
      const structure = this.extractAcademicStructure(text);
      
      // Extract references
      const references = this.extractReferences(text);
      
      // Format as markdown
      const markdown = this.formatAsMarkdown(structure, metadata, references);
      
      return {
        content: text,
        markdown,
        metadata: {
          ...metadata,
          pageCount: data.numpages,
          textLength: text.length,
          sourceUrl,
        },
      };
    } catch (error) {
      elizaLogger.error('[PDFExtractor] Failed to parse PDF:', error);
      return null;
    }
  }

  private extractMetadata(info: any): PDFMetadata {
    return {
      title: info.Title,
      author: info.Author ? [info.Author] : undefined,
      subject: info.Subject,
      keywords: info.Keywords ? info.Keywords.split(/[,;]/).map((k: string) => k.trim()) : undefined,
      creator: info.Creator,
      producer: info.Producer,
      creationDate: info.CreationDate ? new Date(info.CreationDate) : undefined,
      modificationDate: info.ModDate ? new Date(info.ModDate) : undefined,
    };
  }

  private extractAcademicStructure(text: string): AcademicPaperStructure {
    const structure: AcademicPaperStructure = {};
    
    // Extract abstract
    const abstractMatch = text.match(/abstract[:\s]*\n([\s\S]*?)(?=\n\s*(?:introduction|keywords|1\.|i\.))/i);
    if (abstractMatch) {
      structure.abstract = this.cleanText(abstractMatch[1]);
    }
    
    // Extract introduction
    const introMatch = text.match(/(?:1\.|i\.|\n)\s*introduction[:\s]*\n([\s\S]*?)(?=\n\s*(?:2\.|ii\.|method|related))/i);
    if (introMatch) {
      structure.introduction = this.cleanText(introMatch[1]);
    }
    
    // Extract methodology
    const methodMatch = text.match(/(?:method|methodology|approach)[:\s]*\n([\s\S]*?)(?=\n\s*(?:\d\.|results|experiment))/i);
    if (methodMatch) {
      structure.methodology = this.cleanText(methodMatch[1]);
    }
    
    // Extract results
    const resultsMatch = text.match(/(?:results|findings|experiments)[:\s]*\n([\s\S]*?)(?=\n\s*(?:discussion|conclusion|\d\.))/i);
    if (resultsMatch) {
      structure.results = this.cleanText(resultsMatch[1]);
    }
    
    // Extract discussion
    const discussionMatch = text.match(/discussion[:\s]*\n([\s\S]*?)(?=\n\s*(?:conclusion|acknowledgment|references))/i);
    if (discussionMatch) {
      structure.discussion = this.cleanText(discussionMatch[1]);
    }
    
    // Extract conclusion
    const conclusionMatch = text.match(/conclusion[:\s]*\n([\s\S]*?)(?=\n\s*(?:references|acknowledgment|appendix))/i);
    if (conclusionMatch) {
      structure.conclusion = this.cleanText(conclusionMatch[1]);
    }
    
    return structure;
  }

  private extractReferences(text: string): Reference[] {
    const references: Reference[] = [];
    
    // Find references section
    const refMatch = text.match(/(?:references|bibliography)[:\s]*\n([\s\S]*?)(?=\n\s*(?:appendix|$))/i);
    if (!refMatch) return references;
    
    const refText = refMatch[1];
    
    // Split into individual references (numbered or bulleted)
    const refLines = refText.split(/\n(?:\[\d+\]|\d+\.|\•)/);
    
    for (const line of refLines) {
      if (line.trim().length < 20) continue; // Skip short lines
      
      const ref = this.parseReference(line.trim());
      if (ref) references.push(ref);
    }
    
    return references;
  }

  private parseReference(text: string): Reference | null {
    const ref: Reference = {
      id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text,
    };
    
    // Extract DOI
    const doiMatch = text.match(/(?:doi:|https?:\/\/doi\.org\/)(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+)/i);
    if (doiMatch) {
      ref.doi = doiMatch[1];
    }
    
    // Extract year (look for 4-digit year in parentheses or after comma)
    const yearMatch = text.match(/\((\d{4})\)|,\s*(\d{4})/);
    if (yearMatch) {
      ref.year = parseInt(yearMatch[1] || yearMatch[2]);
    }
    
    // Extract authors (before year or first period)
    const authorsMatch = text.match(/^([^.(]+?)(?:\s*\(\d{4}\)|\.)/);
    if (authorsMatch) {
      ref.authors = authorsMatch[1].split(/,|&|and/).map(a => a.trim());
    }
    
    // Extract title (usually in quotes or after year)
    const titleMatch = text.match(/"([^"]+)"|['"]([^'"]+)['"]|\d{4}\)\s*\.?\s*([^.]+)\./);
    if (titleMatch) {
      ref.title = titleMatch[1] || titleMatch[2] || titleMatch[3];
    }
    
    // Extract journal (often in italics or after "In")
    const journalMatch = text.match(/(?:In\s+|[.,]\s*)([A-Z][^,.(]+(?:Journal|Conference|Proceedings|Review)[^,.]*)/);
    if (journalMatch) {
      ref.journal = journalMatch[1].trim();
    }
    
    return ref;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private formatAsMarkdown(
    structure: AcademicPaperStructure,
    metadata: PDFMetadata,
    references: Reference[]
  ): string {
    const sections: string[] = [];
    
    // Title and metadata
    if (metadata.title) {
      sections.push(`# ${metadata.title}\n`);
    }
    
    if (metadata.author?.length) {
      sections.push(`**Authors:** ${metadata.author.join(', ')}\n`);
    }
    
    // Abstract
    if (structure.abstract) {
      sections.push(`## Abstract\n\n${structure.abstract}\n`);
    }
    
    // Main sections
    if (structure.introduction) {
      sections.push(`## Introduction\n\n${structure.introduction}\n`);
    }
    
    if (structure.methodology) {
      sections.push(`## Methodology\n\n${structure.methodology}\n`);
    }
    
    if (structure.results) {
      sections.push(`## Results\n\n${structure.results}\n`);
    }
    
    if (structure.discussion) {
      sections.push(`## Discussion\n\n${structure.discussion}\n`);
    }
    
    if (structure.conclusion) {
      sections.push(`## Conclusion\n\n${structure.conclusion}\n`);
    }
    
    // References
    if (references.length > 0) {
      sections.push(`## References\n`);
      for (const ref of references) {
        const parts = [];
        if (ref.authors?.length) parts.push(ref.authors.join(', '));
        if (ref.year) parts.push(`(${ref.year})`);
        if (ref.title) parts.push(`"${ref.title}"`);
        if (ref.journal) parts.push(ref.journal);
        if (ref.doi) parts.push(`DOI: ${ref.doi}`);
        
        sections.push(`- ${parts.join('. ')}\n`);
      }
    }
    
    return sections.join('\n');
  }

  // Extract specific sections for targeted analysis
  async extractSection(buffer: Buffer, sectionName: string): Promise<string | null> {
    try {
      const parser = await loadPdfParse();
      if (!parser) {
        elizaLogger.warn('[PDFExtractor] PDF parser not available');
        return null;
      }
      
      const data = await parser(buffer);
      const text = data.text;
      
      const sectionRegex = new RegExp(
        `${sectionName}[:\\s]*\\n([\\s\\S]*?)(?=\\n\\s*(?:\\d+\\.|[A-Z][^\\n]*:|References|$))`,
        'i'
      );
      
      const match = text.match(sectionRegex);
      return match ? this.cleanText(match[1]) : null;
    } catch (error) {
      elizaLogger.error(`[PDFExtractor] Failed to extract section ${sectionName}:`, error);
      return null;
    }
  }

  // Check if URL points to a PDF
  static isPDFUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf') || 
           url.includes('pdf') ||
           url.includes('arxiv.org/pdf/');
  }
} 
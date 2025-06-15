export interface ResearchProject {
  id: string;
  query: string;
  status: ResearchStatus;
  phase: ResearchPhase;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  findings: ResearchFinding[];
  sources: ResearchSource[];
  report?: ResearchReport;
  error?: string;
  metadata?: Record<string, any>;
}

export enum ResearchStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export enum ResearchPhase {
  INITIALIZATION = 'initialization',
  PLANNING = 'planning',
  SEARCHING = 'searching',
  ANALYZING = 'analyzing',
  SYNTHESIZING = 'synthesizing',
  REPORTING = 'reporting',
  COMPLETE = 'complete'
}

export interface ResearchFinding {
  id: string;
  content: string;
  source: ResearchSource;
  relevance: number;
  timestamp: number;
  category?: string;
  citations?: Citation[];
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet?: string;
  accessedAt: number;
  type: 'web' | 'pdf' | 'image' | 'file';
  reliability?: number;
}

export interface Citation {
  text: string;
  source: ResearchSource;
  pageNumber?: number;
  confidence?: number;
}

export interface ResearchReport {
  title: string;
  summary: string;
  sections: ReportSection[];
  citations: Citation[];
  generatedAt: number;
}

export interface ReportSection {
  heading: string;
  content: string;
  findings: string[];
  citations: Citation[];
}

export interface ResearchConfig {
  maxSearchResults?: number;
  maxDepth?: number;
  timeout?: number;
  enableCitations?: boolean;
  enableImages?: boolean;
  searchProviders?: string[];
  language?: string;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface ResearchProgress {
  projectId: string;
  phase: ResearchPhase;
  message: string;
  progress: number; // 0-100
  timestamp: number;
}

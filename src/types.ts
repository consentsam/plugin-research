// Core Research Types for DeepResearch Bench Compatibility

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
  metadata: ResearchMetadata;
  evaluationResults?: EvaluationResults;
}

export interface ResearchMetadata {
  domain: ResearchDomain;
  taskType: TaskType;
  language: string;
  depth: ResearchDepth;
  queryPlan: QueryPlan;
  evaluationCriteria: EvaluationCriteria;
  iterationHistory: IterationRecord[];
  performanceMetrics: PerformanceMetrics;
  categoryAnalysis?: Record<string, string>;
  synthesis?: string;
}

// DeepResearch Bench Domain Support (22 domains)
export enum ResearchDomain {
  PHYSICS = 'physics',
  CHEMISTRY = 'chemistry',
  BIOLOGY = 'biology',
  ENVIRONMENTAL_SCIENCE = 'environmental_science',
  ENGINEERING = 'engineering',
  COMPUTER_SCIENCE = 'computer_science',
  MATHEMATICS = 'mathematics',
  MEDICINE = 'medicine',
  PSYCHOLOGY = 'psychology',
  ECONOMICS = 'economics',
  FINANCE = 'finance',
  BUSINESS = 'business',
  MARKETING = 'marketing',
  HUMAN_RESOURCES = 'human_resources',
  LAW = 'law',
  POLITICS = 'politics',
  HISTORY = 'history',
  PHILOSOPHY = 'philosophy',
  ART_DESIGN = 'art_design',
  ENTERTAINMENT = 'entertainment',
  TRANSPORTATION = 'transportation',
  GENERAL = 'general'
}

export enum TaskType {
  EXPLORATORY = 'exploratory',
  COMPARATIVE = 'comparative',
  ANALYTICAL = 'analytical',
  SYNTHETIC = 'synthetic',
  EVALUATIVE = 'evaluative',
  PREDICTIVE = 'predictive'
}

export enum ResearchDepth {
  SURFACE = 'surface',
  MODERATE = 'moderate',
  DEEP = 'deep',
  PHD_LEVEL = 'phd-level'
}

export interface QueryPlan {
  mainQuery: string;
  subQueries: SubQuery[];
  searchStrategy: SearchStrategy;
  expectedSources: number;
  iterationCount: number;
  adaptiveRefinement: boolean;
  domainSpecificApproach: DomainApproach;
}

export interface SubQuery {
  id: string;
  query: string;
  purpose: string;
  priority: number;
  dependsOn: string[];
  searchProviders: string[];
  expectedResultType: ResultType;
  completed: boolean;
  results?: SubQueryResult;
}

export interface SubQueryResult {
  sources: ResearchSource[];
  findings: ResearchFinding[];
  quality: number;
  nextQueries?: string[];
}

export enum ResultType {
  FACTUAL = 'factual',
  STATISTICAL = 'statistical',
  THEORETICAL = 'theoretical',
  PRACTICAL = 'practical',
  COMPARATIVE = 'comparative'
}

export interface SearchStrategy {
  approach: SearchApproach;
  sourceTypes: SourceType[];
  qualityThreshold: number;
  diversityRequirement: boolean;
  temporalFocus?: TemporalFocus;
  geographicScope?: string[];
  languagePreferences: string[];
}

export enum SearchApproach {
  BREADTH_FIRST = 'breadth-first',
  DEPTH_FIRST = 'depth-first',
  ITERATIVE_REFINEMENT = 'iterative-refinement',
  HYPOTHESIS_DRIVEN = 'hypothesis-driven',
  CITATION_CHAINING = 'citation-chaining'
}

export enum TemporalFocus {
  HISTORICAL = 'historical',
  CURRENT = 'current',
  RECENT = 'recent',
  FUTURE_ORIENTED = 'future-oriented'
}

export interface DomainApproach {
  methodology: string;
  keyTerms: string[];
  authoritySource: string[];
  evaluationFocus: string[];
}

export enum ResearchStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
  EVALUATING = 'evaluating'
}

export enum ResearchPhase {
  INITIALIZATION = 'initialization',
  PLANNING = 'planning',
  SEARCHING = 'searching',
  ANALYZING = 'analyzing',
  SYNTHESIZING = 'synthesizing',
  EVALUATING = 'evaluating',
  REPORTING = 'reporting',
  COMPLETE = 'complete'
}

export interface ResearchFinding {
  id: string;
  content: string;
  source: ResearchSource;
  relevance: number;
  confidence: number;
  timestamp: number;
  category: string;
  subcategory?: string;
  citations: Citation[];
  factualClaims: FactualClaim[];
  relatedFindings: string[];
  verificationStatus: VerificationStatus;
  extractionMethod: string;
}

export interface FactualClaim {
  id: string;
  statement: string;
  supportingEvidence: string[];
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  contradictions?: Contradiction[];
  relatedClaims: string[];
}

export interface Contradiction {
  claimId: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  resolution?: string;
}

export enum VerificationStatus {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  DISPUTED = 'disputed',
  PARTIAL = 'partial',
  PENDING = 'pending'
}

export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  snippet?: string;
  fullContent?: string;
  accessedAt: number;
  type: SourceType;
  reliability: number;
  domain?: string;
  author?: string[];
  publishDate?: string;
  lastModified?: string;
  citations?: number;
  peerReviewed?: boolean;
  metadata: SourceMetadata;
}

export enum SourceType {
  WEB = 'web',
  ACADEMIC = 'academic',
  NEWS = 'news',
  TECHNICAL = 'technical',
  BOOK = 'book',
  VIDEO = 'video',
  DATASET = 'dataset',
  GOVERNMENT = 'government',
  ORGANIZATION = 'organization'
}

export interface SourceMetadata {
  journal?: string;
  doi?: string;
  isbn?: string;
  conference?: string;
  institution?: string;
  license?: string;
  language: string;
  wordCount?: number;
  readingLevel?: string;
}

export interface Citation {
  id: string;
  text: string;
  source: ResearchSource;
  pageNumber?: number;
  section?: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  context: string;
  usageCount: number;
}

export interface ResearchReport {
  id: string;
  title: string;
  abstract: string;
  summary: string;
  sections: ReportSection[];
  citations: Citation[];
  bibliography: BibliographyEntry[];
  generatedAt: number;
  wordCount: number;
  readingTime: number;
  evaluationMetrics: EvaluationMetrics;
  exportFormats: ExportFormat[];
}

export interface ReportSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  findings: string[];
  citations: Citation[];
  subsections?: ReportSection[];
  metadata: SectionMetadata;
}

export interface SectionMetadata {
  wordCount: number;
  citationDensity: number;
  readabilityScore: number;
  keyTerms: string[];
}

export interface BibliographyEntry {
  id: string;
  citation: string;
  format: 'APA' | 'MLA' | 'Chicago' | 'Harvard';
  source: ResearchSource;
  accessCount: number;
}

export interface ExportFormat {
  format: 'json' | 'markdown' | 'pdf' | 'deepresearch' | 'latex' | 'docx';
  url?: string;
  generated: boolean;
}

// RACE Evaluation Framework
export interface EvaluationCriteria {
  comprehensiveness: CriteriaDefinition;
  depth: CriteriaDefinition;
  instructionFollowing: CriteriaDefinition;
  readability: CriteriaDefinition;
  domainSpecific?: Record<string, CriteriaDefinition>;
}

export interface CriteriaDefinition {
  name: string;
  description: string;
  weight: number;
  rubric: RubricItem[];
  scoringMethod: ScoringMethod;
}

export interface RubricItem {
  score: number;
  description: string;
  examples?: string[];
}

export enum ScoringMethod {
  BINARY = 'binary',
  SCALE = 'scale',
  RUBRIC = 'rubric',
  COMPARATIVE = 'comparative'
}

export interface EvaluationMetrics {
  raceScore: RACEScore;
  factScore: FACTScore;
  timestamp: number;
  evaluatorVersion: string;
}

export interface RACEScore {
  overall: number;
  comprehensiveness: number;
  depth: number;
  instructionFollowing: number;
  readability: number;
  domainSpecific?: Record<string, number>;
  breakdown: ScoreBreakdown[];
}

export interface ScoreBreakdown {
  criterion: string;
  score: number;
  maxScore: number;
  justification: string;
  improvements: string[];
}

// FACT Evaluation Framework
export interface FACTScore {
  citationAccuracy: number;
  effectiveCitations: number;
  totalCitations: number;
  verifiedCitations: number;
  disputedCitations: number;
  citationCoverage: number;
  sourceCredibility: number;
  breakdown: FactBreakdown[];
}

export interface FactBreakdown {
  sourceId: string;
  citationsFromSource: number;
  verifiedFromSource: number;
  credibilityScore: number;
  issues: string[];
}

// Performance and Optimization
export interface PerformanceMetrics {
  totalDuration: number;
  phaseBreakdown: Record<ResearchPhase, PhaseTiming>;
  searchQueries: number;
  sourcesProcessed: number;
  tokensGenerated: number;
  cacheHits: number;
  parallelOperations: number;
}

export interface PhaseTiming {
  startTime: number;
  endTime: number;
  duration: number;
  retries: number;
  errors: string[];
}

export interface IterationRecord {
  iteration: number;
  timestamp: number;
  queriesUsed: string[];
  sourcesFound: number;
  findingsExtracted: number;
  qualityScore: number;
  refinementReason?: string;
}

// Research Configuration
export interface ResearchConfig {
  maxSearchResults: number;
  maxDepth: number;
  timeout: number;
  enableCitations: boolean;
  enableImages: boolean;
  searchProviders: string[];
  language: string;
  researchDepth: ResearchDepth;
  domain: ResearchDomain;
  evaluationEnabled: boolean;
  cacheEnabled: boolean;
  parallelSearches: number;
  retryAttempts: number;
  qualityThreshold: number;
}

// Search and Content Types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  score: number;
  provider: string;
  metadata: SearchMetadata;
}

export interface SearchMetadata {
  author?: string[];
  publishDate?: string;
  domain?: string;
  type?: string;
  language: string;
  location?: string;
}

// Progress Tracking
export interface ResearchProgress {
  projectId: string;
  phase: ResearchPhase;
  message: string;
  progress: number;
  timestamp: number;
  subProgress?: SubProgress;
  estimatedCompletion?: number;
}

export interface SubProgress {
  current: number;
  total: number;
  description: string;
  items: string[];
}

// Evaluation Results
export interface EvaluationResults {
  projectId: string;
  raceEvaluation: RACEEvaluation;
  factEvaluation: FACTEvaluation;
  overallScore: number;
  recommendations: string[];
  timestamp: number;
}

export interface RACEEvaluation {
  scores: RACEScore;
  referenceComparison?: ReferenceComparison;
  detailedFeedback: DetailedFeedback[];
}

export interface FACTEvaluation {
  scores: FACTScore;
  citationMap: CitationMap;
  verificationDetails: VerificationDetail[];
}

export interface ReferenceComparison {
  referenceId: string;
  similarityScore: number;
  strengths: string[];
  gaps: string[];
}

export interface DetailedFeedback {
  section: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

export interface CitationMap {
  claims: Map<string, string[]>; // claim -> source URLs
  sources: Map<string, string[]>; // source URL -> claims
  verification: Map<string, VerificationStatus>;
}

export interface VerificationDetail {
  claimId: string;
  sourceUrl: string;
  method: string;
  result: VerificationStatus;
  evidence?: string;
  confidence: number;
}

// DeepResearch Bench Format
export interface DeepResearchBenchResult {
  id: string;
  prompt: string;
  article: string;
  metadata: DeepResearchMetadata;
}

export interface DeepResearchMetadata {
  domain: string;
  taskType: string;
  generatedAt: string;
  modelVersion: string;
  evaluationScores: {
    race: RACEScore;
    fact: FACTScore;
  };
}

// Action Chaining Support
export interface ActionContext {
  projectId: string;
  previousAction?: string;
  previousResult?: any;
  suggestedNextActions: string[];
  state: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  nextActions: string[];
  metadata: Record<string, any>;
}

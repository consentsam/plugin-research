import { ModelType } from '@elizaos/core';

/**
 * Advanced prompt templates for deep research
 * These prompts are designed to elicit comprehensive, evidence-based responses
 */

export const RESEARCH_PROMPTS = {
  /**
   * Query Analysis - Extract deep understanding of research intent
   */
  QUERY_ANALYSIS: `Analyze this research query with academic rigor:

Query: "{query}"

Provide a comprehensive analysis including:

1. PRIMARY RESEARCH QUESTION
   - Core inquiry (what is being asked)
   - Implicit assumptions
   - Scope boundaries
   
2. KEY CONCEPTS & ENTITIES
   - Primary concepts (with definitions)
   - Secondary concepts
   - Named entities (people, organizations, places)
   - Technical terms requiring clarification

3. RESEARCH DIMENSIONS
   - Temporal scope (historical/current/predictive)
   - Geographic scope
   - Disciplinary lens
   - Theoretical vs. practical focus
   
4. METHODOLOGICAL REQUIREMENTS
   - Type of evidence needed (empirical/theoretical/mixed)
   - Required data types (quantitative/qualitative)
   - Appropriate research methods
   
5. POTENTIAL BIASES & LIMITATIONS
   - Query biases to be aware of
   - Potential blind spots
   - Alternative framings to consider

6. SUCCESS CRITERIA
   - What constitutes a complete answer
   - Required depth of analysis
   - Expected deliverables

Format as structured JSON with all sections.`,

  /**
   * Sub-query Generation - Create comprehensive search strategy
   */
  SUB_QUERY_GENERATION: `Generate a comprehensive search strategy for this research:

Main Query: "{query}"
Domain: {domain}
Task Type: {taskType}
Temporal Focus: {temporalFocus}

Create 7-10 highly specific sub-queries that:
1. Cover all aspects of the main query
2. Target different types of sources (academic, industry, government)
3. Include methodological variations
4. Address potential counter-arguments
5. Seek quantitative data and statistics
6. Find case studies and real-world examples
7. Identify theoretical frameworks
8. Explore historical context
9. Investigate future implications

For EACH sub-query provide:
- QUERY: The exact search query (optimized for search engines)
- PURPOSE: Why this query is essential (2-3 sentences)
- EXPECTED_SOURCES: Types of sources likely to have this information
- KEYWORDS: Additional keywords and synonyms
- PRIORITY: critical/high/medium/low
- DEPENDENCIES: Other queries that must be completed first
- VERIFICATION_NEEDS: What claims will need fact-checking

Use advanced search operators where appropriate (site:, filetype:, intitle:, etc.)`,

  /**
   * Finding Extraction - Deep content analysis
   */
  FINDING_EXTRACTION: `Extract comprehensive research findings from this source:

Source: {title} ({url})
Original Query: "{query}"
Content Length: {contentLength} characters

Content:
{content}

Extract ALL significant findings following this structure:

For EACH finding:
1. CORE CLAIM
   - Main assertion (precise statement)
   - Supporting evidence (quotes with context)
   - Confidence level (0-1) with justification
   
2. CONTEXT & NUANCE
   - Conditions under which claim holds
   - Exceptions or limitations mentioned
   - Conflicting viewpoints presented
   
3. METHODOLOGY (if applicable)
   - How was this finding derived?
   - Sample size/data sources
   - Statistical significance
   - Potential methodological weaknesses
   
4. CONNECTIONS
   - How this relates to the main research query
   - Connections to other findings
   - Implications for further research
   
5. VERIFICATION REQUIREMENTS
   - What needs to be cross-checked
   - Other sources that might confirm/refute
   - Data that should be verified

Extract 5-15 findings, prioritizing:
- Direct answers to research question
- Surprising or counterintuitive insights  
- Methodologically robust claims
- Recent developments
- Quantitative data
- Expert opinions with credentials

Format as JSON array with all fields populated.`,

  /**
   * Category Synthesis - Deep thematic analysis
   */
  CATEGORY_SYNTHESIS: `Synthesize findings within this thematic category:

Category: {category}
Original Query: "{query}"
Number of Findings: {findingCount}

Findings:
{findings}

Create a comprehensive synthesis (1000-1500 words) that:

1. THEMATIC OVERVIEW
   - Define the category's scope
   - Explain relevance to research question
   - Identify major themes and sub-themes

2. EVIDENCE INTEGRATION
   - Synthesize findings into coherent narrative
   - Identify patterns across sources
   - Note frequency of similar claims
   - Highlight strongest evidence

3. CRITICAL ANALYSIS
   - Evaluate quality of evidence
   - Identify methodological strengths/weaknesses
   - Discuss conflicting findings
   - Assess generalizability

4. THEORETICAL FRAMEWORK
   - Connect to established theories
   - Identify new theoretical contributions
   - Discuss paradigm shifts

5. GAPS & LIMITATIONS
   - What questions remain unanswered
   - Methodological gaps in literature
   - Geographic/demographic blind spots
   - Temporal limitations

6. PRACTICAL IMPLICATIONS
   - Real-world applications
   - Policy recommendations
   - Industry implications
   - Future research directions

Use academic writing style with:
- Topic sentences for each paragraph
- Evidence-based arguments
- Balanced perspective
- Clear transitions
- Precise language`,

  /**
   * Report Enhancement - Second pass deep dive
   */
  REPORT_ENHANCEMENT: `Enhance this research section using detailed source analysis:

Section: {sectionTitle}
Original Content ({originalLength} words):
{originalContent}

Top 10 Source Excerpts (50,000 characters total):
{detailedSources}

Your task is to create a dramatically improved section (1500-2000 words) that:

1. DEPTH ENHANCEMENT
   - Add specific examples from sources
   - Include relevant statistics and data
   - Cite exact studies with methodologies
   - Add historical context
   - Include expert quotes with credentials

2. ANALYTICAL RIGOR
   - Compare conflicting viewpoints
   - Evaluate strength of different arguments
   - Discuss methodological approaches
   - Identify consensus vs. debate areas
   - Address potential biases

3. EVIDENCE INTEGRATION
   - Weave source material naturally
   - Use variety of integration techniques
   - Balance paraphrasing and direct quotes
   - Maintain clear attribution
   - Build arguments progressively

4. CRITICAL INSIGHTS
   - Identify patterns not obvious in sources
   - Make connections between disparate findings
   - Propose new interpretations
   - Highlight surprising discoveries
   - Challenge conventional wisdom where warranted

5. SCHOLARLY APPARATUS
   - Use proper academic citations
   - Include footnotes for tangential points
   - Define technical terms
   - Provide context for specialized knowledge
   - Acknowledge limitations

Maintain sophisticated academic tone while ensuring clarity. Every major claim must be supported by evidence from the provided sources.`,

  /**
   * Verification Check - Fact verification system
   */
  CLAIM_VERIFICATION: `Verify this factual claim against source evidence:

Claim: "{claim}"
Claimed Source: {sourceUrl}
Supporting Evidence Provided: "{evidence}"

Source Content (relevant excerpt):
{sourceContent}

Perform rigorous verification:

1. EXACT MATCH ANALYSIS
   - Does the source contain this exact claim? (quote if yes)
   - Is the claim a reasonable interpretation? (explain)
   - Are there qualifiers in source not in claim?
   
2. CONTEXT EVALUATION  
   - What is the broader context in the source?
   - Could the claim be misleading out of context?
   - Are there contradicting statements nearby?
   
3. PRECISION CHECK
   - Are numbers/dates/names exactly correct?
   - Is the scope accurately represented?
   - Are correlations presented as causations?
   
4. SOURCE CREDIBILITY
   - Is this a primary or secondary source?
   - What are the author's credentials?
   - Is this peer-reviewed/officially published?
   - Are there potential conflicts of interest?
   
5. VERIFICATION RESULT
   - Status: VERIFIED/PARTIALLY_VERIFIED/UNVERIFIED/CONTRADICTED
   - Confidence: 0-1 with detailed justification
   - Corrections needed (if any)
   - Additional sources needed for confirmation

Be extremely rigorous - default to "unverified" unless evidence is clear.`,

  /**
   * Gap Analysis - Identify research gaps
   */
  GAP_ANALYSIS: `Analyze research completeness and identify gaps:

Original Query: "{query}"
Research Summary: {researchSummary}
Categories Covered: {categories}
Sources Analyzed: {sourceCount}
Key Findings: {keyFindings}

Perform comprehensive gap analysis:

1. COVERAGE ASSESSMENT
   - Which aspects of the query are well-covered?
   - Which aspects have limited coverage?
   - What perspectives are missing?
   - Geographic/temporal gaps?

2. EVIDENCE QUALITY GAPS
   - Where is evidence weak or outdated?
   - Which claims lack sufficient support?
   - Where are better methodologies needed?
   - What quantitative data is missing?

3. THEORETICAL GAPS
   - Missing theoretical frameworks?
   - Unaddressed assumptions?
   - Alternative explanations not considered?
   - Interdisciplinary perspectives needed?

4. PRACTICAL GAPS
   - Real-world applications not explored?
   - Implementation challenges not addressed?
   - Cost-benefit analyses missing?
   - Stakeholder perspectives absent?

5. PRIORITIZED RECOMMENDATIONS
   For each gap, specify:
   - Specific searches needed
   - Types of sources to target
   - Experts to consult
   - Data to acquire
   - Estimated impact on research quality

Format as actionable gap-filling strategy.`,

  /**
   * Claim Extraction - Extract verifiable claims from text
   */
  CLAIM_EXTRACTION: `Extract specific, verifiable claims from the following text.

Text: "{text}"

Number of available sources: {sourceCount}

Extract claims that are:
1. SPECIFIC and factual (not vague statements)
2. VERIFIABLE against sources
3. IMPORTANT to the topic

For each claim, provide:
- statement: The exact claim being made
- confidence: Confidence level (0-1)
- sources: URLs of sources that might support this
- evidence: Key supporting evidence snippets
- category: Category of the claim

Return as JSON:
{
  "claims": [
    {
      "statement": "specific factual claim",
      "confidence": 0.8,
      "sources": ["url1", "url2"],
      "evidence": ["supporting snippet 1", "supporting snippet 2"],
      "category": "category name"
    }
  ]
}

Extract at least 5-10 key claims from the text.`,
};

/**
 * Helper function to format prompts with variables
 */
export function formatPrompt(template: string, variables: Record<string, any>): string {
  let formatted = template;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }
  return formatted;
}

/**
 * Get prompt configuration for different research phases
 */
export function getPromptConfig(phase: string): {
  temperature: number;
  maxTokens: number;
  modelType: string;
} {
  switch (phase) {
    case 'analysis':
      return {
        temperature: 0.3,
        maxTokens: 2000,
        modelType: ModelType.TEXT_LARGE,
      };
    case 'extraction':
      return {
        temperature: 0.2,
        maxTokens: 4000,
        modelType: ModelType.TEXT_LARGE,
      };
    case 'synthesis':
      return {
        temperature: 0.7,
        maxTokens: 4000,
        modelType: ModelType.TEXT_LARGE,
      };
    case 'verification':
      return {
        temperature: 0.1,
        maxTokens: 1500,
        modelType: ModelType.TEXT_LARGE,
      };
    default:
      return {
        temperature: 0.5,
        maxTokens: 2000,
        modelType: ModelType.TEXT_LARGE,
      };
  }
} 
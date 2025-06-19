/**
 * Example: Using the Research Plugin with ElizaOS
 *
 * This example shows how the research plugin works within ElizaOS
 */

// Example character configuration with research plugin
export const researchAgentConfig = {
  name: 'ResearchBot',
  description: 'An AI research assistant specialized in deep web research',
  plugins: [
    '@elizaos/plugin-sqlite',
    '@elizaos/plugin-stagehand', // Optional but recommended
    '@elizaos/plugin-research',
  ],
  settings: {
    // Optional: Premium search providers (in order of preference)
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    SERPER_API_KEY: process.env.SERPER_API_KEY,

    // Optional: Premium content extraction
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,

    // Optional but recommended: Browserbase for enhanced scraping
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
  },
};

/**
 * Example conversations with the research agent:
 */

// 1. Start a research project
const example1 = {
  user: 'Can you research the latest AI breakthroughs in 2024?',
  agent:
    "I'll start researching the latest AI breakthroughs in 2024 for you. Let me conduct a comprehensive search and analysis.",
  // Agent internally calls: start_research action
  result:
    "Research project started with ID: abc-123. I'm now searching for information, analyzing sources, and will compile a detailed report.",
};

// 2. Check research status
const example2 = {
  user: "How's the research going?",
  agent: 'Let me check the status of your research project.',
  // Agent internally calls: check_research_status action
  result:
    "Your research on 'latest AI breakthroughs in 2024' is 60% complete. Currently in the analyzing phase. I've found 15 sources and am processing the findings.",
};

// 3. Get research report
const example3 = {
  user: 'Can I see the research report?',
  agent: "I'll retrieve the research report for you.",
  // Agent internally calls: get_research_report action
  result: `# Research Report: Latest AI Breakthroughs in 2024

## Executive Summary
2024 has seen remarkable advances in AI, particularly in multimodal models, efficiency improvements, and reasoning capabilities...

## Key Findings
1. **GPT-5 and Claude 3**: Next-gen models with enhanced reasoning
2. **Multimodal Integration**: Seamless text, image, and video understanding
3. **Efficiency Gains**: 10x reduction in compute requirements...

## Sources
- [1] "2024 AI Breakthroughs" - MIT Technology Review
- [2] "The Year in AI" - Nature Journal
...`,
};

// 4. DeFi specialized research
const example4 = {
  user: 'Research the best DeFi yield farming strategies',
  agent: "I'll conduct specialized research on DeFi yield farming strategies for you.",
  // Agent internally calls: research_defi_yield action
  result:
    "Starting DeFi-focused research on yield farming strategies. I'll analyze protocols, APYs, risks, and provide actionable insights.",
};

/**
 * Behind the scenes, the plugin will:
 *
 * 1. Use the best available search provider:
 *    - Tavily (if API key provided) - AI-optimized search
 *    - Serper (if API key provided) - Google results
 *    - Stagehand/Google (if browserbase available) - Bypasses blocks
 *    - Academic providers (Semantic Scholar, arXiv) - For research papers
 *
 * 2. Use the best available content extractor:
 *    - Stagehand (if browserbase available) - AI extraction, bypasses blocks
 *    - Firecrawl (if API key provided) - Fast API-based extraction
 *    - Playwright (always available) - May get blocked
 *
 * 3. Process through research phases:
 *    - Planning: Create research strategy
 *    - Searching: Find relevant sources
 *    - Analyzing: Extract and rate content
 *    - Synthesizing: Combine findings
 *    - Reporting: Generate final report
 */

/**
 * Configuration Tips:
 *
 * 1. For best results, use browserbase:
 *    - Bypasses most anti-bot measures
 *    - Handles CAPTCHAs automatically
 *    - Uses Google via Stagehand
 *
 * 2. For faster results without browserbase:
 *    - Use Tavily or Serper for search
 *    - Use Firecrawl for content extraction
 *
 * 3. The free tier (no API keys) still works:
 *    - Mock provider returns empty results
 *    - Playwright for extraction
 *    - Limited functionality but no errors
 */

/**
 * Search Providers:
 *    - Tavily (if API key present) - Best overall quality
 *    - Serper (if API key present) - Good alternative
 *    - Semantic Scholar (if API key present) - Academic papers
 *    - Fallback mock provider if none configured
 *
 * Content Extractors:
 *    - Stagehand/Browserbase (if service available) - Most reliable
 *    - Firecrawl (if API key present) - Good cloud option
 *    - Playwright (always available) - Local fallback, may get blocked
 *
 * Result Quality:
 *  3. Stagehand + Serper:
 *    - Uses Google via Serper
 *    - Browserbase for reliable extraction
 *  4. Playwright + Tavily:
 *    - Tavily for search
 *    - Playwright for extraction (may encounter blocks)
 */

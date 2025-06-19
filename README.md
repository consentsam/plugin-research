# ElizaOS Research Plugin

A powerful deep research plugin for ElizaOS that enables AI agents to conduct comprehensive multi-phase internet research with intelligent analysis and synthesis. Designed to achieve top performance on DeepResearch Bench.

## Features

- 🔍 **Multi-phase Research Process**: Planning → Searching → Analyzing → Synthesizing → Reporting
- 🌐 **Multiple Search Providers**: Tavily, Serper, SerpAPI, Exa, and Stagehand integration
- 📄 **Content Extraction**: Browserbase/Stagehand (preferred), Firecrawl, and Playwright
- 💎 **DeFi Specialization**: 10+ specialized DeFi research scenarios
- 📊 **Comprehensive Reports**: Automated report generation with citations
- ⏸️ **Research Control**: Pause, resume, and monitor research progress
- 🧪 **Extensive Testing**: Unit tests and real-world E2E test scenarios
- ⚡ **Rate Limiting**: Automatic rate limiting to avoid API quota issues
- 🧠 **Parallel Processing**: Concurrent searches and content extraction for speed
- 🧪 **Research Evaluation**: Built-in quality assessment using RACE and FACT frameworks
- 🏆 **DeepResearch Bench Compatible**: Supports all 22 research domains

## Prerequisites

Node.js 18+ or Bun runtime

## Installation

```bash
npm install @elizaos/plugin-research
```

## Configuration

Set up the following environment variables in your `.env` file:

```bash
# Search providers (at least one required)
TAVILY_API_KEY=your-tavily-api-key       # Recommended - best for general web search
SERPER_API_KEY=your-serper-api-key       # Alternative to Tavily
SERPAPI_API_KEY=your-serpapi-api-key     # Good for Google results
EXA_API_KEY=your-exa-api-key             # Neural search, great for research

# Content extraction (optional but recommended)
FIRECRAWL_API_KEY=your-firecrawl-key     # Reliable content extraction
PLAYWRIGHT_TIMEOUT=30000                  # Timeout for Playwright (fallback)

# Academic search (optional)
SEMANTIC_SCHOLAR_API_KEY=your-key         # For academic papers (currently may have issues)

# General Settings
RESEARCH_MAX_RESULTS=10          # Max search results per query
RESEARCH_TIMEOUT=300000          # Timeout in milliseconds
RESEARCH_ENABLE_CITATIONS=true   # Enable citation tracking
RESEARCH_ENABLE_IMAGES=true      # Enable image extraction
RESEARCH_LANGUAGE=en             # Preferred language

# Domain-Specific Settings
RESEARCH_DEPTH=moderate          # surface|moderate|deep|phd-level
RESEARCH_PARALLEL_SEARCHES=3     # Number of parallel searches
RESEARCH_CACHE_TTL=3600         # Cache TTL in seconds
```

## Quick Start

### Basic Usage

```typescript
import { researchPlugin } from '@elizaos/plugin-research';

// Add to your ElizaOS agent
const agent = new Agent({
  plugins: [researchPlugin],
  // ... other configuration
});
```

### Available Actions

1. **START_RESEARCH** - Initiates a new research project
2. **SEARCH_AND_EXTRACT** - Searches and extracts content from sources
3. **SYNTHESIZE_RESEARCH** - Analyzes and synthesizes research findings
4. **REFINE_RESEARCH_QUERY** - Refines research queries based on findings
5. **EVALUATE_RESEARCH** - Evaluates research quality using RACE/FACT

### DeFi-Specific Actions

- **defi_security_research** - Security analysis of DeFi protocols
- **analyze_yield_farming** - Yield farming opportunity analysis
- **research_mev** - MEV strategies and protection research
- **analyze_gas_optimization** - Solidity gas optimization techniques
- **analyze_bridge_security** - Cross-chain bridge security analysis
- **comprehensive_defi_analysis** - Multi-area DeFi analysis
- **setup_defi_monitoring** - Real-time DeFi monitoring

## API Providers

### Search Providers

- **Tavily**: High-quality web search with content extraction (Recommended)
- **Serper**: Google search results API
- **SerpAPI**: Another Google search API with more features
- **Exa**: Neural search with similarity and academic paper search
- **Stagehand**: Google search via browser automation (requires Browserbase)

### Content Extraction

- **Firecrawl**: Fast and reliable API-based extraction (Recommended)
- **Browserbase/Stagehand**: AI-powered extraction via browser automation
- **Playwright**: Direct browser automation (fallback, may get blocked)

## Setting up API Keys

### 1. Search Provider (Required - Choose One)

One search provider is required: Either `TAVILY_API_KEY`, `SERPER_API_KEY`, `SERPAPI_API_KEY`, or `EXA_API_KEY`

## Testing

```bash
# Run unit tests
npm test

# Test API integrations
bun run src/scripts/test-apis.ts
```

## Advanced Features

### Custom Research Configuration

```typescript
const project = await researchService.createResearchProject(
  'Your research query',
  {
    maxSearchResults: 20,
    searchProviders: ['web', 'academic'],
    language: 'en',
    metadata: {
      priority: 'high',
      category: 'technical'
    }
  }
);
```

### Research Monitoring

```typescript
// Monitor research progress
const project = await researchService.getProject(projectId);
console.log(`Phase: ${project.phase}, Progress: ${project.progress}%`);
```

## Performance

- **Caching**: Built-in LRU cache for search results
- **Rate Limiting**: Automatic rate limiting for API providers
- **Parallel Processing**: Concurrent search and extraction
- **Resource Management**: Automatic cleanup of browser resources

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Support

- **Documentation**: [ElizaOS Docs](https://elizaos.github.io/eliza/)
- **Discord**: [Join our community](https://discord.gg/elizaos)
- **Issues**: [GitHub Issues](https://github.com/elizaos/eliza/issues)

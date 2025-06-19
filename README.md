# ElizaOS Research Plugin

A powerful deep research plugin for ElizaOS that enables AI agents to conduct comprehensive multi-phase internet research with intelligent analysis and synthesis. Features advanced claim verification, two-step report enhancement, and achieves top performance on DeepResearch Bench.

## Features

- 🔍 **Multi-phase Research Process**: Planning → Searching → Analyzing → Synthesizing → Reporting
- ✅ **Claim Verification**: Cross-references claims across sources with confidence scoring
- 📝 **Two-Step Enhancement**: Initial synthesis followed by evidence-based enhancement
- 🌐 **Multiple Search Providers**: Tavily, Serper, SerpAPI, Exa, and Stagehand integration
- 📄 **Content Extraction**: Browserbase/Stagehand (preferred), Firecrawl, and Playwright
- 💎 **DeFi Specialization**: 10+ specialized DeFi research scenarios
- 📊 **Comprehensive Reports**: Automated report generation with citations and methodology
- ⏸️ **Research Control**: Start, pause, resume, and cancel research projects
- 🧪 **Extensive Testing**: Unit tests and real-world E2E test scenarios
- ⚡ **Rate Limiting**: Automatic rate limiting to avoid API quota issues
- 🧠 **Parallel Processing**: Concurrent searches and content extraction for speed
- 🧪 **Research Evaluation**: Built-in quality assessment using RACE and FACT frameworks
- 🏆 **DeepResearch Bench Compatible**: Supports all 22 research domains

## Prerequisites

- Node.js 18+ or Bun runtime
- At least one search provider API key
- (Optional) Content extraction API key for better results

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
SEMANTIC_SCHOLAR_API_KEY=your-key         # For academic papers

# General Settings
RESEARCH_MAX_RESULTS=10          # Max search results per query
RESEARCH_TIMEOUT=300000          # Timeout in milliseconds (5 minutes)
RESEARCH_ENABLE_CITATIONS=true   # Enable citation tracking
RESEARCH_LANGUAGE=en             # Preferred language

# Advanced Settings
RESEARCH_DEPTH=deep              # surface|moderate|deep|phd-level
RESEARCH_PARALLEL_SEARCHES=3     # Number of parallel searches
RESEARCH_CACHE_TTL=3600         # Cache TTL in seconds
FILE_LOGGING=true               # Enable file output logging
```

## Setting Up the Plugin

### 1. Basic Agent Setup

```typescript
import { Agent } from '@elizaos/core';
import { researchPlugin } from '@elizaos/plugin-research';

// Create an agent with the research plugin
const agent = new Agent({
  name: 'ResearchAgent',
  plugins: [researchPlugin],
  modelProvider: 'openai', // or your preferred model
  // ... other configuration
});

// Start the agent
await agent.start();
```

### 2. Character Configuration

Create a character file that includes research actions:

```json
{
  "name": "Research Assistant",
  "description": "An AI research assistant specialized in comprehensive analysis",
  "plugins": ["@elizaos/plugin-research"],
  "settings": {
    "RESEARCH_DEPTH": "deep",
    "RESEARCH_MAX_RESULTS": "30"
  },
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": {
          "text": "Research the latest developments in quantum computing"
        }
      },
      {
        "user": "{{agentName}}",
        "content": {
          "text": "I'll conduct comprehensive research on the latest developments in quantum computing.",
          "action": "START_RESEARCH"
        }
      }
    ]
  ]
}
```

### 3. Running Research via CLI

```bash
# Start an agent with research capabilities
npx eliza --character characters/research-assistant.json

# In the chat:
> Research the impact of AI on healthcare
> What are the latest breakthroughs in renewable energy?
> Compare different blockchain consensus mechanisms
```

## Using Research Actions

### Available Actions

#### 1. **START_RESEARCH**
Initiates a comprehensive research project.

```typescript
// Example usage in conversation
User: "Research the latest advancements in quantum error correction"
Agent: "I'll start researching the latest advancements in quantum error correction."
// Agent automatically triggers START_RESEARCH action
```

#### 2. **PAUSE_RESEARCH**
Pauses an active research project.

```typescript
User: "Pause the current research"
Agent: "I'll pause the ongoing research project."
```

#### 3. **RESUME_RESEARCH**
Resumes a paused research project.

```typescript
User: "Resume the research"
Agent: "I'll resume the paused research project."
```

#### 4. **CANCEL_RESEARCH**
Cancels an active research project.

```typescript
User: "Cancel the research"
Agent: "I'll cancel the current research project."
```

#### 5. **EVALUATE_RESEARCH**
Evaluates completed research using RACE/FACT frameworks.

```typescript
User: "Evaluate the research quality"
Agent: "I'll evaluate the completed research report."
```

## Programmatic Usage

### Creating a Research Project

```typescript
import { ResearchService } from '@elizaos/plugin-research';

// Get the research service from the runtime
const researchService = runtime.getService('research') as ResearchService;

// Create a research project
const project = await researchService.createResearchProject(
  'Research the latest developments in renewable energy storage',
  {
    researchDepth: 'deep',
    domain: 'engineering',
    maxSearchResults: 30,
    searchProviders: ['web', 'academic'],
    evaluationEnabled: true
  }
);

// Monitor progress
const checkProgress = async () => {
  const updated = await researchService.getProject(project.id);
  console.log(`Status: ${updated.status}, Phase: ${updated.phase}`);
  
  if (updated.status === 'completed') {
    console.log('Research completed!');
    console.log('Report:', updated.report);
  }
};

// Check every 10 seconds
const interval = setInterval(checkProgress, 10000);
```

### Exporting Research Results

```typescript
// Export as Markdown
const markdown = await researchService.exportProject(project.id, 'markdown');
await fs.writeFile('research-report.md', markdown);

// Export as JSON
const json = await researchService.exportProject(project.id, 'json');
await fs.writeFile('research-data.json', json);

// Export for DeepResearch Bench
const benchFormat = await researchService.exportProject(project.id, 'deepresearch');
await fs.writeFile('benchmark-submission.json', benchFormat);
```

## Autocoder Integration

The research plugin can be used with ElizaOS's autocoder capabilities for automated code research and implementation:

### 1. Code Research Scenarios

```typescript
// Research and implement a specific algorithm
User: "Research and implement the A* pathfinding algorithm in TypeScript"

// Research best practices and generate code
User: "Research React performance optimization techniques and create a guide"

// Analyze existing codebases
User: "Research how authentication is implemented in popular Node.js frameworks"
```

### 2. DeFi Code Research

The plugin includes specialized DeFi research actions:

```typescript
// Security analysis
User: "Analyze the security of Uniswap V3's smart contracts"

// Gas optimization research
User: "Research gas optimization techniques for Solidity smart contracts"

// MEV research
User: "Research MEV protection strategies for DeFi protocols"
```

### 3. Automated Implementation Workflow

```typescript
// 1. Research phase
const research = await researchService.createResearchProject(
  'Research best practices for implementing JWT authentication in Node.js'
);

// 2. Wait for completion
// ... monitoring code ...

// 3. Use research to generate implementation
const implementation = await autocoderService.generateImplementation({
  research: research.report,
  language: 'typescript',
  framework: 'express',
  includeTests: true
});
```

## Advanced Configuration

### Domain-Specific Research

```typescript
const project = await researchService.createResearchProject(query, {
  domain: 'computer_science', // Automatically selects appropriate providers
  researchDepth: 'phd-level', // Maximum depth
  searchProviders: ['web', 'academic', 'github'],
  evaluationEnabled: true,
  cacheEnabled: true
});
```

### Custom Search Strategies

```typescript
// Configure search strategy
const config = {
  searchStrategy: {
    approach: 'iterative-refinement',
    maxIterations: 5,
    qualityThreshold: 0.8,
    diversityRequirement: true
  },
  contentExtraction: {
    preferredExtractor: 'firecrawl',
    fallbackExtractor: 'playwright',
    extractImages: true,
    extractTables: true
  }
};
```

## Performance Optimization

### 1. Enable Caching

```bash
RESEARCH_CACHE_ENABLED=true
RESEARCH_CACHE_TTL=7200  # 2 hours
```

### 2. Parallel Processing

```bash
RESEARCH_PARALLEL_SEARCHES=5     # Increase for faster results
RESEARCH_PARALLEL_EXTRACTIONS=3  # Parallel content extraction
```

### 3. Rate Limiting

The plugin automatically handles rate limiting, but you can configure:

```bash
RESEARCH_RATE_LIMIT_DELAY=1000   # Delay between requests (ms)
RESEARCH_MAX_RETRIES=3           # Retry failed requests
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- research.test.ts
npm test -- e2e.test.ts

# Test API connections
bun run src/__tests__/verify-apis.test.ts

# Run benchmark test
bun run test-benchmark.ts
```

## DeepResearch Bench Integration

The plugin is designed to achieve top scores on DeepResearch Bench:

```bash
# Prepare benchmark submission
bun run src/scripts/prepare-benchmark.ts

# Run benchmark evaluation
cd deep_research_bench
python deepresearch_bench_race.py elizaos-research --limit 5
```

## Troubleshooting

### Common Issues

1. **No search results**: Ensure at least one search API key is configured
2. **Content extraction fails**: Add FIRECRAWL_API_KEY for reliable extraction
3. **Research times out**: Increase RESEARCH_TIMEOUT value
4. **Rate limit errors**: Reduce RESEARCH_PARALLEL_SEARCHES

### Debug Mode

```bash
DEBUG=eliza:research:* npm start
```

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

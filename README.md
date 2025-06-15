# ElizaOS Research Plugin

A powerful deep research plugin for ElizaOS that enables AI agents to conduct comprehensive multi-phase internet research with intelligent analysis and synthesis.

## Features

- 🔍 **Multi-phase Research Process**: Planning → Searching → Analyzing → Synthesizing → Reporting
- 🌐 **Multiple Search Providers**: DuckDuckGo (free), Tavily, Serper, and Stagehand integration
- 📄 **Content Extraction**: Browserbase/Stagehand (preferred), Playwright, and Firecrawl
- 💎 **DeFi Specialization**: 10+ specialized DeFi research scenarios
- 📊 **Comprehensive Reports**: Automated report generation with citations
- ⏸️ **Research Control**: Pause, resume, and monitor research progress
- 🧪 **Extensive Testing**: Unit tests and real-world E2E test scenarios

## Installation

```bash
npm install @elizaos/plugin-research
```

## Configuration

### Environment Variables

```env
# Optional - Search Providers (defaults to DuckDuckGo if not set)
TAVILY_API_KEY=your_tavily_api_key
SERPER_API_KEY=your_serper_api_key

# Optional - Content Extractors (defaults to Playwright if not set)
FIRECRAWL_API_KEY=your_firecrawl_api_key

# Research Settings
RESEARCH_MAX_RESULTS=10
RESEARCH_TIMEOUT=300000
RESEARCH_ENABLE_CITATIONS=true
RESEARCH_ENABLE_IMAGES=true
RESEARCH_LANGUAGE=en
```

## Usage

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

1. **start_research** - Start a new research project
   ```
   "Research the latest developments in quantum computing"
   ```

2. **check_research_status** - Check status of ongoing research
   ```
   "What's the status of my research?"
   ```

3. **get_research_report** - Get the final research report
   ```
   "Show me the research report"
   ```

4. **pause_research** - Pause an active research project
   ```
   "Pause the research"
   ```

5. **resume_research** - Resume a paused research project
   ```
   "Resume the research"
   ```

### DeFi-Specific Actions

- **defi_security_research** - Security analysis of DeFi protocols
- **analyze_yield_farming** - Yield farming opportunity analysis
- **research_mev** - MEV strategies and protection research
- **analyze_gas_optimization** - Solidity gas optimization techniques
- **analyze_bridge_security** - Cross-chain bridge security analysis
- **comprehensive_defi_analysis** - Multi-area DeFi analysis
- **setup_defi_monitoring** - Real-time DeFi monitoring

## Architecture

### Research Phases

1. **Planning**: Creates a research strategy based on the query
2. **Searching**: Searches multiple sources for relevant information
3. **Analyzing**: Extracts key insights and patterns
4. **Synthesizing**: Organizes findings into coherent categories
5. **Reporting**: Generates comprehensive report with citations

### Search Providers

- **DuckDuckGo**: Free, no API key required (default)
- **Tavily**: AI-optimized search (requires API key)
- **Serper**: Google search results (requires API key)
- **Stagehand**: Browser-based search via browserbase

### Content Extractors (Priority Order)

1. **Browserbase/Stagehand**: AI-powered extraction via browserbase (preferred - avoids blocking)
   - Automatically used if browserbase plugin is installed
   - Uses real browser automation with AI extraction
   - Best success rate on sites that block scrapers

2. **Firecrawl**: API-based content extraction (requires API key)
   - Fast and reliable when available
   - Good for high-volume extraction

3. **Playwright**: Browser automation for content extraction (fallback)
   - Free but may get blocked by some sites
   - Uses headless browser automation

### Why Browserbase is Preferred

Many websites block automated scrapers and headless browsers. Browserbase/Stagehand provides:
- Real browser fingerprints that appear human
- AI-powered content extraction that adapts to different page structures
- Built-in handling of anti-bot measures
- Cloud-based execution that avoids IP blocking

To enable browserbase:
```bash
npm install @elizaos/plugin-browserbase
```

## Examples

### Simple Research

```typescript
// User: "Research the impact of AI on healthcare in 2024"
// Assistant: "I'll start a deep research project on the impact of AI on healthcare in 2024."

// The plugin will:
// 1. Create a research plan
// 2. Search for relevant sources
// 3. Extract and analyze content
// 4. Generate a comprehensive report
```

### DeFi Security Research

```typescript
// User: "Research security vulnerabilities in Aave v3"
// Assistant: "I'll conduct a comprehensive security analysis of Aave v3."

// Specialized analysis includes:
// - Known vulnerabilities
// - Audit reports
// - Best practices
// - Mitigation strategies
```

## Testing

The plugin includes comprehensive test coverage:

### Unit Tests
```bash
npm test
```

### Real-World E2E Tests
- Feature Development Research
- Person Background Research
- Breaking News Research
- Market Intelligence
- Technical Problem Solving
- Academic Research

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

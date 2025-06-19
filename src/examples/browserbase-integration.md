# Browserbase Integration for Research Plugin

## Overview

The Research Plugin automatically detects and uses browserbase when available, providing enhanced web scraping capabilities that bypass blocks and CAPTCHAs.

## Setup

1. Install both plugins:

```bash
bun add @elizaos/plugin-research @elizaos/plugin-stagehand
# or
npm install @elizaos/plugin-research @elizaos/plugin-stagehand
```

2. Configure environment variables:

```env
# Browserbase Configuration (Optional but recommended)
BROWSERBASE_API_KEY=your_api_key
BROWSERBASE_PROJECT_ID=your_project_id

# Optional: Use specific AI model for extraction
OPENAI_API_KEY=your_openai_key
# or
ANTHROPIC_API_KEY=your_anthropic_key
```

3. Load both plugins in your ElizaOS config:

```typescript
import { researchPlugin } from '@elizaos/plugin-research';
import { stagehandPlugin } from '@elizaos/plugin-stagehand';

const config = {
  plugins: [
    stagehandPlugin, // Load browserbase first
    researchPlugin, // Research will auto-detect it
  ],
};
```

## How It Works

When browserbase is available, the research plugin will:

1. **Use Stagehand Google Search** instead of DuckDuckGo for better results
2. **Use Stagehand Content Extraction** with AI-powered extraction instead of Playwright
3. **Bypass blocks and CAPTCHAs** automatically

## Benefits

### Without Browserbase (Default)

- Uses DuckDuckGo (free but limited)
- Uses Playwright (often gets blocked)
- Timeouts on many sites (Forbes, WSJ, etc.)
- No CAPTCHA solving

### With Browserbase

- Uses Google search via Stagehand
- AI-powered content extraction
- Bypasses most anti-bot measures
- Handles CAPTCHAs automatically
- Much faster and more reliable

## Example Usage

```typescript
// The agent will automatically use browserbase if available
const response = await agent.sendMessage({
  text: 'start_research Latest AI breakthroughs in 2024',
});

// You'll see in logs:
// "Using Stagehand Google search provider"
// "Using Stagehand content extractor (via browserbase)"
```

## Fallback Chain

The research plugin has a smart fallback system:

1. **Search Providers** (in order):

   - Tavily (if API key provided)
   - Serper (if API key provided)
   - Stagehand/Google (if browserbase available)
   - DuckDuckGo (always available, no API needed)

2. **Content Extractors** (in order):
   - Stagehand (if browserbase available)
   - Firecrawl (if API key provided)
   - Playwright (always available but often blocked)

## Testing

Run the included test to verify browserbase integration:

```bash
cd packages/plugin-research
./test-research-live.sh
```

You should see:

```
📋 Configuration:
   Search Provider: Stagehand/Google
   Content Extractor: Stagehand/Browserbase
```

## Troubleshooting

### "No stagehand service found"

- Ensure stagehandPlugin is loaded BEFORE researchPlugin
- Check that browserbase plugin initialized correctly

### Still getting blocked

- Verify BROWSERBASE_API_KEY is set correctly
- Check browserbase dashboard for usage/errors
- Some sites may still block even with browserbase

### Slow performance

- Browserbase sessions take time to initialize
- Consider caching results for repeated queries
- Use fewer search results (maxSearchResults: 5)

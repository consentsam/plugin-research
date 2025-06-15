# Deep Research Plugin - Example Research Scenarios

This document provides real-world examples of how to use the deep research plugin for various research tasks.

## 1. Technical Research Scenario

**Topic**: "Performance comparison of Next.js 14 App Router vs Pages Router"

### Expected Research Flow

```typescript
// User interaction
User: "Research the performance differences between Next.js 14 App Router and Pages Router"

// Agent initiates research
Agent: "I'll start a deep research project on the performance differences between Next.js 14 App Router and Pages Router."

// Research phases:

// 1. Planning Phase
- Identify key performance metrics (FCP, LCP, TTI, Bundle size)
- Plan to search for benchmarks, case studies, official docs
- Define comparison criteria

// 2. Searching Phase
- Search for "Next.js 14 App Router performance benchmarks"
- Search for "Next.js Pages Router vs App Router comparison"
- Search for "Next.js 14 migration performance impact"
- Collect 10-15 high-quality sources

// 3. Analyzing Phase
- Extract performance metrics from each source
- Identify consensus and contradictions
- Note specific use cases where each excels

// 4. Synthesizing Phase
- Group findings by performance aspect
- Create comparison tables
- Identify best practices

// 5. Reporting Phase
- Generate comprehensive report with:
  - Executive summary
  - Detailed performance comparisons
  - Migration considerations
  - Recommendations based on use case
```

### Expected Output

```markdown
# Research Report: Performance comparison of Next.js 14 App Router vs Pages Router

## Executive Summary
This research analyzed 12 sources to compare the performance characteristics of Next.js 14's App Router versus the traditional Pages Router. Key findings indicate that App Router offers superior performance for dynamic applications with frequent data updates, while Pages Router maintains advantages for static content delivery.

## Key Performance Findings

### 1. Initial Load Performance
- **App Router**: 15-20% slower initial bundle size due to React Server Components runtime
- **Pages Router**: Faster initial load for static pages (average 1.2s vs 1.5s)

### 2. Runtime Performance
- **App Router**: Better runtime performance with streaming SSR
- **Pages Router**: More predictable performance profile

### 3. Build Performance
- **App Router**: Faster incremental builds (30% improvement)
- **Pages Router**: Better full build times for large applications

## Recommendations
- Use App Router for: Dynamic applications, real-time features, complex data requirements
- Use Pages Router for: Static sites, blogs, marketing pages

## Sources
1. [Vercel Official Benchmarks](https://vercel.com/blog/next-14-performance) - Official performance metrics
2. [Web.dev Case Study](https://web.dev/next-js-performance) - Real-world migration analysis
[... additional sources ...]
```

## 2. Market Research Scenario

**Topic**: "AI adoption trends in healthcare industry 2024"

### Research Configuration

```typescript
const researchConfig = {
  maxSearchResults: 20,
  language: 'en',
  scope: 'Focus on clinical applications, regulatory developments, and market size',
  enableImages: true,
  searchProviders: ['tavily', 'serper']
};
```

### Expected Phases

1. **Planning**: Identify key areas (clinical AI, diagnostic AI, administrative AI)
2. **Searching**: Gather data from healthcare journals, industry reports, regulatory filings
3. **Analyzing**: Extract adoption rates, use cases, challenges, success stories
4. **Synthesizing**: Create industry overview with trends and projections
5. **Reporting**: Comprehensive market analysis with data visualizations

## 3. Academic Research Scenario

**Topic**: "Recent advances in quantum error correction codes"

### Special Considerations

```typescript
// Configure for academic research
const academicConfig = {
  searchProviders: ['arxiv', 'scholar', 'pubmed'],
  enableCitations: true,
  citationStyle: 'APA',
  maxSearchResults: 30,
  prioritizePeerReviewed: true
};
```

### Expected Sources
- ArXiv preprints
- Nature/Science publications
- IEEE Quantum Computing proceedings
- University research papers

## 4. Competitive Analysis Scenario

**Topic**: "Comparison of major LLM providers APIs and pricing models"

### Research Structure

```typescript
// User request
User: "Research and compare the APIs and pricing of OpenAI, Anthropic, Google, and Cohere"

// Research focus areas
const competitiveAnalysis = {
  providers: ['OpenAI', 'Anthropic', 'Google Gemini', 'Cohere'],
  aspects: [
    'API features',
    'Pricing models',
    'Rate limits',
    'Model capabilities',
    'Documentation quality',
    'SDK support'
  ]
};
```

### Expected Deliverables

1. **Comparison Matrix**
   - Feature availability across providers
   - Pricing tiers and token costs
   - Rate limits and quotas

2. **Technical Analysis**
   - API design patterns
   - Authentication methods
   - Error handling approaches

3. **Business Insights**
   - Total cost of ownership calculations
   - Use case recommendations
   - Migration considerations

## 5. Real-time Event Research

**Topic**: "Impact of recent Federal Reserve rate decision on tech stocks"

### Time-Sensitive Configuration

```typescript
const realtimeConfig = {
  maxAge: 24, // Only sources from last 24 hours
  searchProviders: ['news', 'financial'],
  updateFrequency: 'hourly',
  alertOnMajorDevelopments: true
};
```

### Expected Workflow

1. **Initial Research**: Gather immediate market reactions
2. **Follow-up Analysis**: Track evolving analyst opinions
3. **Synthesis**: Connect rate decision to tech valuations
4. **Continuous Monitoring**: Update findings as new data emerges

## 6. Product Research Scenario

**Topic**: "Best practices for implementing RAG systems in production"

### Implementation Focus

```typescript
// Research parameters
const productResearch = {
  scope: `
    - Vector database selection
    - Chunking strategies
    - Retrieval optimization
    - Evaluation metrics
    - Production challenges
  `,
  includeCodeExamples: true,
  prioritizeRecentContent: true
};
```

### Expected Sections

1. **Architecture Patterns**
   - Hybrid search approaches
   - Reranking strategies
   - Cache optimization

2. **Implementation Details**
   - Code examples from GitHub
   - Performance benchmarks
   - Cost analysis

3. **Case Studies**
   - Company implementations
   - Lessons learned
   - Common pitfalls

## Testing Research Quality

### Quality Metrics

```typescript
interface ResearchQualityMetrics {
  sourceCredibility: number; // 0-1 score
  informationCompleteness: number; // 0-1 score
  findingRelevance: number; // 0-1 score
  citationAccuracy: number; // 0-1 score
  reportCoherence: number; // 0-1 score
}

// Example quality assessment
const assessQuality = (project: ResearchProject): ResearchQualityMetrics => {
  return {
    sourceCredibility: calculateSourceCredibility(project.sources),
    informationCompleteness: assessTopicCoverage(project.findings),
    findingRelevance: measureRelevanceScore(project.findings, project.query),
    citationAccuracy: verifyCitations(project.report.citations),
    reportCoherence: analyzeReportStructure(project.report)
  };
};
```

## Integration Examples

### 1. Slack Integration

```typescript
// Respond to Slack message with research
app.message(/research (.+)/, async ({ message, say }) => {
  const topic = message.text.match(/research (.+)/)[1];
  
  const project = await researchService.createProject(topic);
  await say(`Starting research on: ${topic}`);
  
  // Send updates as research progresses
  researchService.on('progress', async (update) => {
    await say(`Research update: ${update.phase} - ${update.progress}%`);
  });
  
  // Send final report
  researchService.on('complete', async (project) => {
    await say({
      text: 'Research complete!',
      attachments: [{
        title: project.report.title,
        text: project.report.summary,
        fields: project.report.sections.map(s => ({
          title: s.heading,
          value: s.content.substring(0, 500) + '...',
          short: false
        }))
      }]
    });
  });
});
```

### 2. Discord Bot Integration

```typescript
client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!research')) {
    const topic = message.content.replace('!research', '').trim();
    
    const embed = new EmbedBuilder()
      .setTitle('Research Started')
      .setDescription(`Researching: ${topic}`)
      .setColor(0x0099FF);
    
    const reply = await message.reply({ embeds: [embed] });
    
    const project = await researchService.createProject(topic);
    
    // Update embed with progress
    const updateInterval = setInterval(async () => {
      const status = await researchService.getProjectStatus(project.id);
      
      embed.setFields([
        { name: 'Status', value: status.status, inline: true },
        { name: 'Phase', value: status.currentPhase, inline: true },
        { name: 'Progress', value: `${status.progress}%`, inline: true }
      ]);
      
      await reply.edit({ embeds: [embed] });
      
      if (status.status === 'completed') {
        clearInterval(updateInterval);
        // Send full report as file
        const report = await researchService.getReport(project.id);
        const buffer = Buffer.from(report.markdown, 'utf-8');
        await message.channel.send({
          content: 'Research complete! Here\'s your report:',
          files: [{
            attachment: buffer,
            name: `research-${topic.replace(/\s+/g, '-')}.md`
          }]
        });
      }
    }, 5000);
  }
});
```

## Advanced Usage Patterns

### 1. Comparative Research

```typescript
// Compare multiple topics
const comparativeResearch = async (topics: string[]) => {
  const projects = await Promise.all(
    topics.map(topic => researchService.createProject(topic))
  );
  
  // Wait for all to complete
  await Promise.all(
    projects.map(p => waitForCompletion(p.id))
  );
  
  // Generate comparative analysis
  const comparison = await synthesizeComparison(projects);
  return comparison;
};

// Example usage
const frameworks = ['React', 'Vue', 'Angular', 'Svelte'];
const comparison = await comparativeResearch(
  frameworks.map(f => `${f} performance benchmarks 2024`)
);
```

### 2. Scheduled Research

```typescript
// Daily research updates
const scheduleResearch = (topic: string, schedule: string) => {
  cron.schedule(schedule, async () => {
    const project = await researchService.createProject(
      `${topic} - updates for ${new Date().toDateString()}`
    );
    
    await waitForCompletion(project.id);
    
    // Send report to stakeholders
    await emailService.send({
      to: stakeholders,
      subject: `Daily Research Update: ${topic}`,
      body: project.report.markdown
    });
  });
};

// Run every day at 9 AM
scheduleResearch('AI industry news', '0 9 * * *');
```

### 3. Research Pipeline

```typescript
// Multi-stage research pipeline
const researchPipeline = async (initialTopic: string) => {
  // Stage 1: Broad research
  const overview = await researchService.createProject(initialTopic);
  await waitForCompletion(overview.id);
  
  // Stage 2: Deep dive into top findings
  const keyAreas = extractKeyAreas(overview.report);
  const deepDives = await Promise.all(
    keyAreas.map(area => researchService.createProject(area))
  );
  
  // Stage 3: Synthesize all research
  const synthesis = await createSynthesisReport([overview, ...deepDives]);
  
  return synthesis;
};
``` 
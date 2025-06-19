import {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ModelType,
  elizaLogger,
} from '@elizaos/core';
import { ResearchService } from './service';
import {
  ResearchStatus,
  ResearchPhase,
  ResearchDomain,
  TaskType,
  ResearchDepth,
  ActionResult,
  ActionContext,
  ResearchProject,
} from './types';

// Helper function to extract domain from text
async function extractDomain(runtime: IAgentRuntime, text: string): Promise<ResearchDomain> {
  try {
    const prompt = `Analyze this text and determine the most appropriate research domain:
Text: "${text}"

Domains: ${Object.values(ResearchDomain).join(', ')}

Respond with just the domain name.`;

    const response = await runtime.useModel(ModelType.TEXT_SMALL, {
      messages: [{ role: 'user', content: prompt }],
    });

    const domainText = (typeof response === 'string' ? response : (response as any).content || '')
      .toLowerCase()
      .trim();

    // Map response to enum
    for (const domain of Object.values(ResearchDomain)) {
      if (domainText.includes(domain)) {
        return domain as ResearchDomain;
      }
    }

    return ResearchDomain.GENERAL;
  } catch (error) {
    elizaLogger.error('Error extracting domain:', error);
    // Default to GENERAL if model call fails
    return ResearchDomain.GENERAL;
  }
}

// Helper function to extract task type
async function extractTaskType(runtime: IAgentRuntime, text: string): Promise<TaskType> {
  try {
    const prompt = `Analyze this research query and determine the task type:
Query: "${text}"

Task Types:
- exploratory: General exploration of a topic
- comparative: Comparing multiple items/concepts
- analytical: Deep analysis of a specific aspect
- synthetic: Combining multiple perspectives
- evaluative: Assessing or judging something
- predictive: Forecasting or trend analysis

Respond with just the task type.`;

    const response = await runtime.useModel(ModelType.TEXT_SMALL, {
      messages: [{ role: 'user', content: prompt }],
    });

    const taskText = (typeof response === 'string' ? response : (response as any).content || '')
      .toLowerCase()
      .trim();

    if (taskText.includes('comparative')) return TaskType.COMPARATIVE;
    if (taskText.includes('analytical')) return TaskType.ANALYTICAL;
    if (taskText.includes('synthetic')) return TaskType.SYNTHETIC;
    if (taskText.includes('evaluative')) return TaskType.EVALUATIVE;
    if (taskText.includes('predictive')) return TaskType.PREDICTIVE;

    return TaskType.EXPLORATORY;
  } catch (error) {
    elizaLogger.error('Error extracting task type:', error);
    // Default to EXPLORATORY if model call fails
    return TaskType.EXPLORATORY;
  }
}

// Helper function to extract research depth
async function extractDepth(runtime: IAgentRuntime, text: string): Promise<ResearchDepth> {
  try {
    const prompt = `Analyze this research query and determine the appropriate depth:
Query: "${text}"

Depths:
- surface: Quick overview, basic information
- moderate: Standard research with good coverage
- deep: Comprehensive research with detailed analysis
- phd-level: Expert-level research with citations and academic rigor

Look for keywords like: quick, overview, detailed, comprehensive, expert, academic, thorough

Respond with just the depth level.`;

    const response = await runtime.useModel(ModelType.TEXT_SMALL, {
      messages: [{ role: 'user', content: prompt }],
    });

    const depthText = (typeof response === 'string' ? response : (response as any).content || '')
      .toLowerCase()
      .trim();

    if (depthText.includes('surface')) return ResearchDepth.SURFACE;
    if (depthText.includes('deep')) return ResearchDepth.DEEP;
    if (depthText.includes('phd')) return ResearchDepth.PHD_LEVEL;

    return ResearchDepth.MODERATE;
  } catch (error) {
    elizaLogger.error('Error extracting depth:', error);
    // Default to MODERATE if model call fails
    return ResearchDepth.MODERATE;
  }
}

/**
 * Start a new research project
 */
export const startResearchAction: Action = {
  name: 'start_research',
  description: 'Start a new deep research project on any topic across 22+ domains',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService && (message.content.text?.trim().length || 0) > 3;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    const query = message.content.text?.trim() || '';

    // Extract research parameters
    const [domain, taskType, depth] = await Promise.all([
      extractDomain(runtime, query),
      extractTaskType(runtime, query),
      extractDepth(runtime, query),
    ]);

    elizaLogger.info(`Starting research: domain=${domain}, type=${taskType}, depth=${depth}`);

    try {
      const project = await researchService.createResearchProject(query, {
        domain,
        researchDepth: depth,
      });

      const response = {
        text: `I've initiated a ${depth}-level ${taskType} research project in the ${domain} domain.

📋 **Research Details:**
- Query: "${project.query}"
- Domain: ${domain}
- Task Type: ${taskType}
- Depth: ${depth}
- Project ID: ${project.id}

🔄 **Research Phases:**
1. Planning - Developing research strategy
2. Searching - Gathering sources
3. Analyzing - Extracting insights
4. Synthesizing - Connecting findings
5. Evaluating - Quality assessment
6. Reporting - Creating comprehensive report

The research will follow DeepResearch Bench standards for quality. I'll notify you when complete.`,
        metadata: {
          projectId: project.id,
          project,
          action: 'start_research',
        },
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: project,
        nextActions: ['check_research_status', 'refine_research_query', 'pause_research'],
        metadata: {
          projectId: project.id,
          domain,
          taskType,
          depth,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to start research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['start_research'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Research the impact of quantum computing on cryptography with academic rigor',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll start a comprehensive research project on quantum computing's impact on cryptography.",
          action: 'start_research',
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Give me a quick overview of sustainable urban transportation solutions',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll conduct a surface-level exploratory research on sustainable urban transportation.",
          action: 'start_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Check research status
 */
export const checkResearchStatusAction: Action = {
  name: 'check_research_status',
  description: 'Check the status and progress of research projects',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      // Check if a specific project ID is mentioned
      const projectIdMatch = message.content.text?.match(/project[:\s]+([a-zA-Z0-9-]+)/i);
      let projects: any[] = [];

      if (projectIdMatch) {
        const project = await researchService.getProject(projectIdMatch[1]);
        if (project) projects = [project];
      } else {
        // Get all active projects
        projects = await researchService.getActiveProjects();

        // If no active, get recent completed
        if (projects.length === 0) {
          const allProjects = await researchService.getAllProjects();
          projects = allProjects.slice(-3); // Last 3 projects
        }
      }

      if (projects.length === 0) {
        const response = {
          text: 'No research projects found. Would you like to start a new research project?',
          metadata: { status: 'no_projects' },
        };

        if (callback) await callback(response);

        return {
          success: true,
          data: { projects: [] },
          nextActions: ['start_research'],
          metadata: { count: 0 },
        };
      }

      // Format status report
      const statusReports = projects
        .map((project) => {
          const phaseProgress =
            Object.values(ResearchPhase).indexOf(project.phase) /
            (Object.values(ResearchPhase).length - 1);
          const percentComplete = Math.round(phaseProgress * 100);

          return `📊 **${project.query}**
- Status: ${project.status} (${percentComplete}% complete)
- Phase: ${project.phase}
- Domain: ${project.metadata.domain}
- Sources: ${project.sources.length} collected
- Findings: ${project.findings.length} extracted
- Started: ${new Date(project.createdAt).toLocaleString()}`;
        })
        .join('\n\n');

      const response = {
        text: `# Research Status Report\n\n${statusReports}`,
        metadata: { projects },
      };

      if (callback) await callback(response);

      // Determine next actions based on project states
      const hasActive = projects.some((p) => p.status === ResearchStatus.ACTIVE);
      const hasCompleted = projects.some((p) => p.status === ResearchStatus.COMPLETED);

      const nextActions = [];
      if (hasActive) {
        nextActions.push('pause_research', 'refine_research_query');
      }
      if (hasCompleted) {
        nextActions.push('get_research_report', 'evaluate_research', 'export_research');
      }
      nextActions.push('start_research');

      return {
        success: true,
        data: { projects },
        nextActions,
        metadata: {
          activeCount: projects.filter((p) => p.status === ResearchStatus.ACTIVE).length,
          completedCount: projects.filter((p) => p.status === ResearchStatus.COMPLETED).length,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to check research status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['start_research'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: "What's the status of my research projects?",
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll check the status of your research projects.",
          action: 'check_research_status',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Refine research query
 */
export const refineResearchQueryAction: Action = {
  name: 'refine_research_query',
  description: 'Refine or expand the research query based on findings',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const activeProjects = await researchService.getActiveProjects();
    return activeProjects.length > 0;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const activeProjects = await researchService.getActiveProjects();
      if (activeProjects.length === 0) {
        return {
          success: false,
          error: 'No active research projects to refine',
          nextActions: ['start_research'],
          metadata: {},
        };
      }

      const project = activeProjects[activeProjects.length - 1];

      // Extract refinement direction from message
      const refinementPrompt = `Analyze this refinement request for the research query "${project.query}":
User request: "${message.content.text || ''}"

Determine:
1. Refinement type (narrow/broaden/pivot/deepen)
2. New focus areas (2-3 specific areas)
3. Additional queries (2-3 refined queries)

Respond with JSON:
{
  "refinementType": "type",
  "focusAreas": ["area1", "area2"],
  "queries": ["query1", "query2"]
}`;

      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [{ role: 'user', content: refinementPrompt }],
      });

      let refinement;
      try {
        const content = typeof response === 'string' ? response : (response as any).content || '';
        refinement = JSON.parse(content);
      } catch (e) {
        refinement = {
          refinementType: 'deepen',
          focusAreas: ['specific aspects', 'detailed analysis'],
          queries: [`${project.query} detailed analysis`, `${project.query} case studies`],
        };
      }

      // Add refined queries to the project
      await researchService.addRefinedQueries(project.id, refinement.queries);

      const responseText = {
        text: `I've refined the research focus for your project.

🎯 **Refinement Applied:**
- Type: ${refinement.refinementType}
- New Focus Areas: ${refinement.focusAreas.join(', ')}

📝 **Additional Queries:**
${refinement.queries.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

The research will now explore these refined aspects while maintaining the original scope.`,
        metadata: { project, refinement },
      };

      if (callback) await callback(responseText);

      return {
        success: true,
        data: { project, refinement },
        nextActions: ['check_research_status', 'get_research_report'],
        metadata: {
          projectId: project.id,
          refinementType: refinement.refinementType,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to refine research query:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Focus more on the security implications and recent breakthroughs',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll refine the research to focus on security implications and recent breakthroughs.",
          action: 'refine_research_query',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Get research report
 */
export const getResearchReportAction: Action = {
  name: 'get_research_report',
  description: 'Get the comprehensive research report with citations',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const projects = await researchService.getAllProjects();
    return projects.some((p: ResearchProject) => p.status === ResearchStatus.COMPLETED);
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const allProjects = await researchService.getAllProjects();
      const completedProjects = allProjects.filter((p: ResearchProject) => p.status === ResearchStatus.COMPLETED);

      if (completedProjects.length === 0) {
        return {
          success: false,
          error: 'No completed research projects found',
          nextActions: ['check_research_status', 'start_research'],
          metadata: {},
        };
      }

      const project = completedProjects[completedProjects.length - 1];
      if (!project.report) {
        return {
          success: false,
          error: 'Report generation in progress, please try again shortly',
          nextActions: ['check_research_status'],
          metadata: { projectId: project.id },
        };
      }

      // Format the report
      let reportText = `# ${project.report.title}\n\n`;
      reportText += `**Generated:** ${new Date(project.report.generatedAt).toLocaleString()}\n`;
      reportText += `**Domain:** ${project.metadata.domain}\n`;
      reportText += `**Word Count:** ${project.report.wordCount.toLocaleString()}\n`;
      reportText += `**Reading Time:** ${project.report.readingTime} minutes\n\n`;

      // Add evaluation scores if available
      if (project.report.evaluationMetrics) {
        const race = project.report.evaluationMetrics.raceScore;
        const fact = project.report.evaluationMetrics.factScore;

        reportText += `## Quality Metrics\n`;
        reportText += `**RACE Score:** ${(race.overall * 100).toFixed(1)}%\n`;
        reportText += `**FACT Score:** ${(fact.citationAccuracy * 100).toFixed(1)}% accuracy\n\n`;
      }

      reportText += `## Executive Summary\n\n${project.report.summary}\n\n`;

      // Add sections
      for (const section of project.report.sections) {
        reportText += `## ${section.heading}\n\n`;
        reportText += `${section.content}\n\n`;

        if (section.subsections) {
          for (const subsection of section.subsections) {
            reportText += `### ${subsection.heading}\n\n`;
            reportText += `${subsection.content}\n\n`;
          }
        }
      }

      // Add references
      reportText += `## References (${project.report.citations.length})\n\n`;
      const bibliography = project.report.bibliography || [];
      bibliography.forEach((entry: any, idx: number) => {
        reportText += `${idx + 1}. ${entry.citation}\n`;
      });

      const response = {
        text: reportText,
        metadata: { project, report: project.report },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: { project, report: project.report },
        nextActions: ['evaluate_research', 'export_research', 'compare_research', 'start_research'],
        metadata: {
          projectId: project.id,
          wordCount: project.report.wordCount,
          citationCount: project.report.citations.length,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to get research report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Show me the research report',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll retrieve the comprehensive research report for you.",
          action: 'get_research_report',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Evaluate research quality
 */
export const evaluateResearchAction: Action = {
  name: 'evaluate_research',
  description: 'Evaluate research quality using RACE and FACT frameworks',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const projects = await researchService.getAllProjects();
    return projects.some((p: ResearchProject) => p.status === ResearchStatus.COMPLETED && p.report);
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const allProjects = await researchService.getAllProjects();
      const evaluableProjects = allProjects.filter(
        (p: ResearchProject) => p.status === ResearchStatus.COMPLETED && p.report && !p.evaluationResults
      );

      if (evaluableProjects.length === 0) {
        const alreadyEvaluated = allProjects.filter((p: ResearchProject) => p.evaluationResults);
        if (alreadyEvaluated.length > 0) {
          const project = alreadyEvaluated[alreadyEvaluated.length - 1];
          const evaluation = project.evaluationResults!;

          const response = {
            text: `This research has already been evaluated:

**Overall Score:** ${(evaluation.overallScore * 100).toFixed(1)}%

**RACE Scores:**
- Comprehensiveness: ${(evaluation.raceEvaluation.scores.comprehensiveness * 100).toFixed(1)}%
- Depth: ${(evaluation.raceEvaluation.scores.depth * 100).toFixed(1)}%
- Instruction Following: ${(evaluation.raceEvaluation.scores.instructionFollowing * 100).toFixed(1)}%
- Readability: ${(evaluation.raceEvaluation.scores.readability * 100).toFixed(1)}%

**FACT Scores:**
- Citation Accuracy: ${(evaluation.factEvaluation.scores.citationAccuracy * 100).toFixed(1)}%
- Effective Citations: ${evaluation.factEvaluation.scores.effectiveCitations}
- Source Credibility: ${(evaluation.factEvaluation.scores.sourceCredibility * 100).toFixed(1)}%`,
            metadata: { evaluation },
          };

          if (callback) await callback(response);

          return {
            success: true,
            data: evaluation,
            nextActions: ['export_research', 'compare_research', 'start_research'],
            metadata: { projectId: project.id },
          };
        }

        return {
          success: false,
          error: 'No completed research projects available for evaluation',
          nextActions: ['check_research_status', 'start_research'],
          metadata: {},
        };
      }

      const project = evaluableProjects[0];
      elizaLogger.info(`Starting evaluation for project ${project.id}`);

      // Run evaluation
      const evaluation = await researchService.evaluateProject(project.id);

      const response = {
        text: `# Research Evaluation Complete

**Overall Score:** ${(evaluation.overallScore * 100).toFixed(1)}%

## RACE Evaluation (Research Quality)
- **Comprehensiveness:** ${(evaluation.raceEvaluation.scores.comprehensiveness * 100).toFixed(1)}%
- **Depth:** ${(evaluation.raceEvaluation.scores.depth * 100).toFixed(1)}%
- **Instruction Following:** ${(evaluation.raceEvaluation.scores.instructionFollowing * 100).toFixed(1)}%
- **Readability:** ${(evaluation.raceEvaluation.scores.readability * 100).toFixed(1)}%

## FACT Evaluation (Citation Quality)
- **Citation Accuracy:** ${(evaluation.factEvaluation.scores.citationAccuracy * 100).toFixed(1)}%
- **Verified Citations:** ${evaluation.factEvaluation.scores.verifiedCitations}/${evaluation.factEvaluation.scores.totalCitations}
- **Source Credibility:** ${(evaluation.factEvaluation.scores.sourceCredibility * 100).toFixed(1)}%

## Recommendations
${evaluation.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`,
        metadata: { project, evaluation },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: evaluation,
        nextActions: ['export_research', 'compare_research', 'start_research'],
        metadata: {
          projectId: project.id,
          overallScore: evaluation.overallScore,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to evaluate research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['get_research_report'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Evaluate the quality of my research',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll evaluate your research using RACE and FACT frameworks.",
          action: 'evaluate_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Export research in various formats
 */
export const exportResearchAction: Action = {
  name: 'export_research',
  description: 'Export research report in various formats including DeepResearch Bench',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const projects = await researchService.getAllProjects();
    return projects.some((p: ResearchProject) => p.status === ResearchStatus.COMPLETED && p.report);
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      // Extract format from message
      const formatMatch = message.content.text?.match(
        /\b(json|markdown|deepresearch|pdf|latex|docx)\b/i
      );
      const format = (formatMatch?.[1]?.toLowerCase() || 'markdown') as any;

      const allProjects = await researchService.getAllProjects();
      const exportableProjects = allProjects.filter(
        (p: ResearchProject) => p.status === ResearchStatus.COMPLETED && p.report
      );

      if (exportableProjects.length === 0) {
        return {
          success: false,
          error: 'No completed research projects available for export',
          nextActions: ['check_research_status', 'start_research'],
          metadata: {},
        };
      }

      const project = exportableProjects[exportableProjects.length - 1];
      const exported = await researchService.exportProject(project.id, format);

      let responseText = `Research exported successfully in ${format.toUpperCase()} format.\n\n`;

      if (format === 'deepresearch') {
        responseText += `**DeepResearch Bench Format:**
- ID: ${project.id}
- Domain: ${project.metadata.domain}
- Task Type: ${project.metadata.taskType}
- Ready for submission to DeepResearch Bench evaluation\n\n`;
      }

      // For text formats, include a preview
      if (['json', 'markdown'].includes(format)) {
        const preview = exported.substring(0, 500);
        responseText += `**Preview:**\n\`\`\`${format}\n${preview}...\n\`\`\``;
      }

      const response = {
        text: responseText,
        metadata: {
          project,
          format,
          exported: format === 'json' || format === 'markdown' ? exported : '[Binary data]',
        },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: { format, content: exported },
        nextActions: ['compare_research', 'start_research'],
        metadata: {
          projectId: project.id,
          format,
          size: exported.length,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to export research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['get_research_report'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Export my research in DeepResearch format',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll export your research in DeepResearch Bench format.",
          action: 'export_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Compare multiple research projects
 */
export const compareResearchAction: Action = {
  name: 'compare_research',
  description: 'Compare multiple research projects on similar topics',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const projects = await researchService.getAllProjects();
    const completedProjects = projects.filter((p: ResearchProject) => p.status === ResearchStatus.COMPLETED);
    return completedProjects.length >= 2;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const allProjects = await researchService.getAllProjects();
      const completedProjects = allProjects.filter((p: ResearchProject) => p.status === ResearchStatus.COMPLETED);

      if (completedProjects.length < 2) {
        return {
          success: false,
          error: 'Need at least 2 completed research projects to compare',
          nextActions: ['start_research', 'check_research_status'],
          metadata: { availableProjects: completedProjects.length },
        };
      }

      // Get the most recent projects or specific ones mentioned
      const projectsToCompare = completedProjects.slice(-2);
      const projectIds = projectsToCompare.map((p: ResearchProject) => p.id);

      const comparison = await researchService.compareProjects(projectIds);

      const response = {
        text: `# Research Comparison

## Projects Compared:
${projectsToCompare.map((p: ResearchProject, i: number) => `${i + 1}. **${p.query}** (${p.metadata.domain})`).join('\n')}

## Similarity Score: ${(comparison.similarity * 100).toFixed(1)}%

## Key Differences:
${comparison.differences.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}

## Unique Insights:
${Object.entries(comparison.uniqueInsights)
  .map(([id, insights]) => {
    const project = projectsToCompare.find((p: ResearchProject) => p.id === id);
    return `\n**${project?.query}:**\n${(insights as string[]).map((insight, i) => `- ${insight}`).join('\n')}`;
  })
  .join('\n')}

## Quality Comparison:
${comparison.qualityComparison.map((q: any) => `- ${q.metric}: ${q.comparison}`).join('\n')}

## Recommendation:
${comparison.recommendation}`,
        metadata: { comparison, projects: projectsToCompare },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: comparison,
        nextActions: ['start_research', 'export_research'],
        metadata: {
          projectIds,
          similarity: comparison.similarity,
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to compare research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Compare my recent research projects',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll compare your recent research projects for similarities and differences.",
          action: 'compare_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Pause ongoing research
 */
export const pauseResearchAction: Action = {
  name: 'pause_research',
  description: 'Pause an active research project',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const activeProjects = await researchService.getActiveProjects();
    return activeProjects.length > 0;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const activeProjects = await researchService.getActiveProjects();
      if (activeProjects.length === 0) {
        return {
          success: false,
          error: 'No active research projects to pause',
          nextActions: ['check_research_status', 'start_research'],
          metadata: {},
        };
      }

      const project = activeProjects[activeProjects.length - 1];
      await researchService.pauseResearch(project.id);

      const response = {
        text: `Research project paused successfully.

**Project:** ${project.query}
**Phase:** ${project.phase}
**Progress:** ${project.sources.length} sources, ${project.findings.length} findings

You can resume this research at any time.`,
        metadata: { project },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: project,
        nextActions: ['resume_research', 'check_research_status'],
        metadata: { projectId: project.id },
      };
    } catch (error) {
      elizaLogger.error('Failed to pause research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Pause the current research',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll pause the active research project.",
          action: 'pause_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Resume paused research
 */
export const resumeResearchAction: Action = {
  name: 'resume_research',
  description: 'Resume a paused research project',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const allProjects = await researchService.getAllProjects();
    return allProjects.some((p: ResearchProject) => p.status === ResearchStatus.PAUSED);
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      const allProjects = await researchService.getAllProjects();
      const pausedProjects = allProjects.filter((p: ResearchProject) => p.status === ResearchStatus.PAUSED);

      if (pausedProjects.length === 0) {
        return {
          success: false,
          error: 'No paused research projects to resume',
          nextActions: ['check_research_status', 'start_research'],
          metadata: {},
        };
      }

      const project = pausedProjects[pausedProjects.length - 1];
      await researchService.resumeResearch(project.id);

      const response = {
        text: `Research project resumed successfully.

**Project:** ${project.query}
**Resuming from:** ${project.phase}
**Current progress:** ${project.sources.length} sources, ${project.findings.length} findings

The research will continue from where it left off.`,
        metadata: { project },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: project,
        nextActions: ['check_research_status', 'pause_research', 'refine_research_query'],
        metadata: { projectId: project.id },
      };
    } catch (error) {
      elizaLogger.error('Failed to resume research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Resume the paused research',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll resume the paused research project.",
          action: 'resume_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Cancel a research project
 */
export const cancelResearchAction: Action = {
  name: 'cancel_research',
  description: 'Cancel an active or paused research project',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return false;

    const allProjects = await researchService.getAllProjects();
    return allProjects.some((p: ResearchProject) => 
      p.status === ResearchStatus.ACTIVE || 
      p.status === ResearchStatus.PAUSED ||
      p.status === ResearchStatus.PENDING
    );
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<ActionResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    try {
      // Check for specific project ID in message
      const projectIdMatch = message.content.text?.match(/project[:\s]+([a-zA-Z0-9-]+)/i);
      let projectToCancel: any = null;

      if (projectIdMatch) {
        const projectId = projectIdMatch[1];
        projectToCancel = await researchService.getProject(projectId);
        
        if (!projectToCancel) {
          return {
            success: false,
            error: `Project ${projectId} not found`,
            nextActions: ['check_research_status', 'start_research'],
            metadata: {},
          };
        }
      } else {
        // Get all cancellable projects
        const allProjects = await researchService.getAllProjects();
        const cancellableProjects = allProjects.filter((p: ResearchProject) => 
          p.status === ResearchStatus.ACTIVE || 
          p.status === ResearchStatus.PAUSED ||
          p.status === ResearchStatus.PENDING
        );

        if (cancellableProjects.length === 0) {
          return {
            success: false,
            error: 'No active or paused research projects to cancel',
            nextActions: ['check_research_status', 'start_research'],
            metadata: {},
          };
        }

        // Cancel the most recent cancellable project
        projectToCancel = cancellableProjects[cancellableProjects.length - 1];
      }

      // Cancel the project by setting status to FAILED
      projectToCancel.status = ResearchStatus.FAILED;
      projectToCancel.error = 'Cancelled by user';
      projectToCancel.updatedAt = Date.now();
      
      // Stop active research if running
      await researchService.pauseResearch(projectToCancel.id);

      const response = {
        text: `Research project cancelled successfully.

**Project:** ${projectToCancel.query}
**Status was:** ${projectToCancel.status}
**Phase was:** ${projectToCancel.phase}
**Progress:** ${projectToCancel.sources.length} sources collected, ${projectToCancel.findings.length} findings extracted

The project has been permanently cancelled and cannot be resumed.`,
        metadata: { project: projectToCancel },
      };

      if (callback) await callback(response);

      return {
        success: true,
        data: projectToCancel,
        nextActions: ['start_research', 'check_research_status'],
        metadata: { 
          projectId: projectToCancel.id,
          cancelledFrom: projectToCancel.status 
        },
      };
    } catch (error) {
      elizaLogger.error('Failed to cancel research:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        nextActions: ['check_research_status'],
        metadata: {},
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Cancel the current research project',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll cancel the active research project.",
          action: 'cancel_research',
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Cancel project: abc-123-def',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll cancel the specified research project.",
          action: 'cancel_research',
        },
      },
    ],
  ] as ActionExample[][],
};

// Export all actions
export const researchActions = [
  startResearchAction,
  checkResearchStatusAction,
  refineResearchQueryAction,
  getResearchReportAction,
  evaluateResearchAction,
  exportResearchAction,
  compareResearchAction,
  pauseResearchAction,
  resumeResearchAction,
  cancelResearchAction,
];

export const allResearchActions = researchActions;

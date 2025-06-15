import {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ModelType,
} from '@elizaos/core';
import { ResearchService } from './service';
import { ResearchStatus, ResearchPhase, ReportSection } from './types';
import { defiActions } from './actions/defi-actions';

export const startResearchAction: Action = {
  name: 'start_research',
  description: 'Start a new deep research project on a specific topic',

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
  ) {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    // Extract topic from message using LLM
    const extractionPrompt = `Extract the research topic from the user's message.
    
User message: "${message.content.text}"

Respond with a JSON object containing:
{
  "topic": "the main research topic",
  "scope": "specific areas or questions to focus on",
  "maxSources": number of sources to collect (default 10)
}`;

    const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    let params;
    try {
      const responseContent = typeof extraction === 'string' 
        ? extraction 
        : (extraction as any).response || (extraction as any).content || '';
      params = JSON.parse(responseContent);
    } catch (e) {
      params = {
        topic: message.content.text,
        scope: '',
        maxSources: 10
      };
    }

    const project = await researchService.createResearchProject(
      params.topic,
      {
        maxSearchResults: params.maxSources,
        language: 'en',
      }
    );
    
    // Add scope to metadata
    if (params.scope && project.metadata) {
      project.metadata.scope = params.scope;
    }

    const response = {
      text: `I've started a deep research project on "${project.query}". 
      
Project ID: ${project.id}
Status: ${project.status}
Current Phase: ${project.phase}

I'll conduct comprehensive research through multiple phases:
1. Planning the research strategy
2. Searching for relevant sources
3. Analyzing the findings
4. Synthesizing the information
5. Creating a comprehensive report

You can check the status anytime or wait for the research to complete.`,
      metadata: { project },
    };

    if (callback) {
      await callback(response);
    }

    return response;
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Research the impact of AI on healthcare in 2024',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll start a deep research project on the impact of AI on healthcare in 2024.",
          action: 'start_research',
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Do a deep dive on quantum computing breakthroughs this year',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll conduct comprehensive research on quantum computing breakthroughs this year.",
          action: 'start_research',
        },
      },
    ],
  ] as ActionExample[][],
};

export const checkResearchStatusAction: Action = {
  name: 'check_research_status',
  description: 'Check the status of an ongoing research project',

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
  ) {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    // Extract project ID from message or get most recent
    const extractionPrompt = `Extract the research project ID from the user's message, or indicate if they want the most recent project.
    
User message: "${message.content.text}"

Respond with a JSON object:
{
  "projectId": "project ID if mentioned" or null,
  "getMostRecent": true/false
}`;

    const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    let params;
    try {
      const responseContent = typeof extraction === 'string' 
        ? extraction 
        : (extraction as any).response || (extraction as any).content || '';
      params = JSON.parse(responseContent);
    } catch (e) {
      params = { getMostRecent: true };
    }

    let project;
    if (params.projectId) {
      project = await researchService.getProject(params.projectId);
    } else if (params.getMostRecent) {
      const projects = await researchService.getActiveProjects();
      project = projects[projects.length - 1];
    }

    if (!project) {
      const response = {
        text: "No research projects found. Would you like to start a new research project?",
        metadata: { status: 'no_projects' },
      };
      if (callback) await callback(response);
      return response;
    }

    // Calculate project status and progress
    const status = {
      status: project.status,
      currentPhase: project.phase,
      progress: Math.floor((Object.keys(ResearchPhase).indexOf(project.phase) / (Object.keys(ResearchPhase).length - 1)) * 100)
    };
    
    const phaseDescriptions: Record<string, string> = {
      initialization: 'Starting up the research process',
      planning: 'Creating a research strategy and identifying key areas to explore',
      searching: 'Searching for relevant sources and information',
      analyzing: 'Analyzing and extracting insights from collected sources',
      synthesizing: 'Organizing and connecting the findings',
      reporting: 'Creating the final comprehensive report',
      complete: 'Research completed'
    };

    let statusText = `Research Project Status:
Topic: "${project.query}"
Project ID: ${project.id}
Status: ${status.status}
Current Phase: ${status.currentPhase} - ${phaseDescriptions[status.currentPhase]}
Progress: ${status.progress}%
Started: ${new Date(project.createdAt).toLocaleString()}`;

    if (status.status === ResearchStatus.COMPLETED && project.report) {
      statusText += `\n\nResearch complete! The report is ready with ${project.findings.length} findings from ${project.sources.length} sources.`;
    } else if (status.status === ResearchStatus.ACTIVE) {
      statusText += `\n\nThe research is actively progressing. Current findings: ${project.findings.length}`;
    }

    const response = {
      text: statusText,
      metadata: { project, status },
    };

    if (callback) {
      await callback(response);
    }

    return response;
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: "What's the status of my research?",
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll check the status of your research project.",
          action: 'check_research_status',
        },
      },
    ],
  ] as ActionExample[][],
};

export const getResearchReportAction: Action = {
  name: 'get_research_report',
  description: 'Get the final report from a completed research project',

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
  ) {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    // Similar extraction logic as status check
    const extractionPrompt = `Extract the research project ID from the user's message, or indicate if they want the most recent project.
    
User message: "${message.content.text}"

Respond with a JSON object:
{
  "projectId": "project ID if mentioned" or null,
  "getMostRecent": true/false
}`;

    const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    let params;
    try {
      const responseContent = typeof extraction === 'string' 
        ? extraction 
        : (extraction as any).response || (extraction as any).content || '';
      params = JSON.parse(responseContent);
    } catch (e) {
      params = { getMostRecent: true };
    }

    let project;
    if (params.projectId) {
      project = await researchService.getProject(params.projectId);
    } else if (params.getMostRecent) {
      const allProjects = await researchService.getAllProjects();
      const completedProjects = allProjects.filter(p => p.status === ResearchStatus.COMPLETED);
      project = completedProjects[completedProjects.length - 1];
    }

    if (!project) {
      const response = {
        text: "No completed research projects found. Use 'check research status' to see ongoing projects.",
        metadata: { status: 'no_completed_projects' },
      };
      if (callback) await callback(response);
      return response;
    }

    if (!project.report) {
      const response = {
        text: `The research project "${project.query}" is not yet complete. Current phase: ${project.phase}`,
        metadata: { project },
      };
      if (callback) await callback(response);
      return response;
    }

    // Format the report with citations
    let reportText = `# Research Report: ${project.query}\n\n`;
    reportText += `**Generated:** ${new Date(project.report.generatedAt).toLocaleString()}\n\n`;
    reportText += `## Executive Summary\n\n${project.report.summary}\n\n`;
    
    reportText += `## Key Findings\n\n`;
    project.report.sections.forEach((section: ReportSection, idx: number) => {
      reportText += `### ${idx + 1}. ${section.heading}\n\n`;
      reportText += `${section.content}\n\n`;
    });

    reportText += `## Sources (${project.sources.length})\n\n`;
    project.sources.forEach((source, idx) => {
      reportText += `${idx + 1}. [${source.title}](${source.url}) - ${source.snippet}\n`;
    });

    const response = {
      text: reportText,
      metadata: { 
        project,
        report: project.report,
        wordCount: reportText.split(' ').length 
      },
    };

    if (callback) {
      await callback(response);
    }

    return response;
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
          text: "I'll retrieve the research report for you.",
          action: 'get_research_report',
        },
      },
    ],
  ] as ActionExample[][],
};

export const pauseResearchAction: Action = {
  name: 'pause_research',
  description: 'Pause an ongoing research project',

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
  ) {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    // Get the most recent active project (or extract ID from message)
    const projects = await researchService.getActiveProjects();
    if (projects.length === 0) {
      const response = {
        text: "No active research projects to pause.",
        metadata: { status: 'no_active_projects' },
      };
      if (callback) await callback(response);
      return response;
    }

    const project = projects[projects.length - 1];
    await researchService.pauseResearch(project.id);

    const response = {
      text: `Research project "${project.query}" has been paused at phase: ${project.phase}. You can resume it anytime.`,
      metadata: { project },
    };

    if (callback) {
      await callback(response);
    }

    return response;
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Pause the research',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll pause the ongoing research project.",
          action: 'pause_research',
        },
      },
    ],
  ] as ActionExample[][],
};

export const resumeResearchAction: Action = {
  name: 'resume_research',
  description: 'Resume a paused research project',

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
  ) {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) {
      throw new Error('Research service not available');
    }

    // Get the most recent paused project
    const allProjects = await researchService.getAllProjects();
    const pausedProjects = allProjects.filter(
      p => p.status === ResearchStatus.PAUSED
    );
    
    if (pausedProjects.length === 0) {
      const response = {
        text: "No paused research projects to resume.",
        metadata: { status: 'no_paused_projects' },
      };
      if (callback) await callback(response);
      return response;
    }

    const project = pausedProjects[pausedProjects.length - 1];
    await researchService.resumeResearch(project.id);

    const response = {
      text: `Research project "${project.query}" has been resumed. Continuing from phase: ${project.phase}.`,
      metadata: { project },
    };

    if (callback) {
      await callback(response);
    }

    return response;
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Resume the research',
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

export const researchActions = [
  startResearchAction,
  checkResearchStatusAction,
  getResearchReportAction,
  pauseResearchAction,
  resumeResearchAction,
];

// Export all actions including DeFi actions
export const allResearchActions = [
  ...researchActions,
  ...defiActions,
];

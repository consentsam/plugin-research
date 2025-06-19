import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  ProviderResult,
} from '@elizaos/core';
import { ResearchService } from './service';
import { ResearchStatus, ResearchPhase } from './types';

export const activeResearchProvider: Provider = {
  name: 'active_research',
  description: 'Provides information about active research projects',

  async get(runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return { text: '' };

    const activeProjects = await researchService.getActiveProjects();
    if (activeProjects.length === 0) return { text: '' };

    const projectInfo = activeProjects.map(project => {
      const phaseProgress = Math.floor(
        (Object.keys(ResearchPhase).indexOf(project.phase) / (Object.keys(ResearchPhase).length - 1)) * 100
      );
      
      return `- Research on "${project.query}" (ID: ${project.id})
  Status: ${project.status}
  Phase: ${project.phase} (${phaseProgress}% complete)
  Findings collected: ${project.findings.length}
  Sources: ${project.sources.length}`;
    }).join('\n\n');

    return { text: `Active Research Projects:\n${projectInfo}` };
  },
};

export const completedResearchProvider: Provider = {
  name: 'completed_research',
  description: 'Provides information about completed research projects with reports',

  async get(runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> {
    const researchService = runtime.getService<ResearchService>('research');
    if (!researchService) return { text: '' };

    const allProjects = await researchService.getAllProjects();
    const completedProjects = allProjects.filter(p => p.status === ResearchStatus.COMPLETED);
    
    if (completedProjects.length === 0) return { text: '' };

    const projectInfo = completedProjects
      .slice(-5) // Show last 5 completed projects
      .map(project => {
        const reportSummary = project.report 
          ? `Report available (${project.report.sections.length} sections)`
          : 'Report generation pending';
        
        return `- "${project.query}" (ID: ${project.id})
  Completed: ${new Date(project.completedAt || project.updatedAt).toLocaleDateString()}
  ${reportSummary}
  Findings: ${project.findings.length}, Sources: ${project.sources.length}`;
      }).join('\n\n');

    return { text: `Recently Completed Research:\n${projectInfo}` };
  },
};

export const researchCapabilitiesProvider: Provider = {
  name: 'research_capabilities',
  description: 'Provides information about research service capabilities',

  async get(runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> {
    const researchService = runtime.getService<ResearchService>('research');
    
    // Always return capabilities info, even if service is not currently available
    return { text: `Research Capabilities:
- Deep multi-phase internet research
- Automatic source collection and verification
- Intelligent analysis and synthesis
- Comprehensive report generation with citations
- Research phases: planning, searching, analyzing, synthesizing, reporting
- Can pause and resume research projects
- Supports multiple concurrent research projects` };
  },
};

export const researchProviders = [
  activeResearchProvider,
  completedResearchProvider,
  researchCapabilitiesProvider,
]; 
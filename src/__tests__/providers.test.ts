import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAgentRuntime, Memory, State } from '@elizaos/core';
import {
  activeResearchProvider,
  completedResearchProvider,
  researchCapabilitiesProvider
} from '../providers';
import { ResearchService } from '../service';
import { ResearchStatus, ResearchPhase, ResearchDomain, TaskType, ResearchDepth } from '../types';

describe('Research Providers', () => {
  let mockRuntime: IAgentRuntime;
  let mockService: ResearchService;
  let mockMemory: Memory;
  let mockState: State;
  
  beforeEach(() => {
    // Create mock service
    mockService = {
      getActiveProjects: vi.fn().mockResolvedValue([]),
      getProject: vi.fn().mockResolvedValue(null),
      getAllProjects: vi.fn().mockResolvedValue([]),
    } as any;
    
    // Create mock runtime
    mockRuntime = {
      agentId: 'test-agent',
      getService: vi.fn().mockReturnValue(mockService),
    } as any;
    
    // Create mock memory and state
    mockMemory = {
      id: '00000000-0000-0000-0000-000000000000' as any,
      content: { text: 'test query' },
      entityId: 'test-entity',
      roomId: 'test-room',
    } as unknown as Memory;
    
    mockState = {
      values: {},
      data: {},
      text: 'test state',
    } as State;
  });
  
  describe('activeResearchProvider', () => {
    it('should provide active research project information', async () => {
      const mockProject = {
        id: 'project-1',
        query: 'quantum computing',
        status: ResearchStatus.ACTIVE,
        phase: ResearchPhase.SEARCHING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        findings: [],
        sources: [],
        metadata: {
          domain: ResearchDomain.PHYSICS,
          taskType: TaskType.EXPLORATORY,
          language: 'en',
          depth: ResearchDepth.MODERATE,
        }
      };
      
      mockService.getActiveProjects = vi.fn().mockResolvedValue([mockProject]);
      
      const result = await activeResearchProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result).toBeDefined();
      expect(result.text).toContain('Research on "quantum computing"');
      expect(result.text).toContain('searching');
    });
    
    it('should handle no active projects', async () => {
      mockService.getActiveProjects = vi.fn().mockResolvedValue([]);
      
      const result = await activeResearchProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toBe('');
    });
    
    it('should handle service not available', async () => {
      mockRuntime.getService = vi.fn().mockReturnValue(null);
      
      const result = await activeResearchProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toBe('');
    });
  });
  
  describe('completedResearchProvider', () => {
    it('should provide completed research project information', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          query: 'AI ethics',
          status: ResearchStatus.COMPLETED,
          phase: ResearchPhase.COMPLETE,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 1800000,
          completedAt: Date.now() - 1800000,
          findings: Array(15).fill({}),
          sources: Array(20).fill({}),
          report: {
            sections: ['Introduction', 'Analysis', 'Conclusion']
          },
          metadata: {
            domain: ResearchDomain.PHILOSOPHY,
            taskType: TaskType.EVALUATIVE,
            language: 'en',
            depth: ResearchDepth.DEEP,
          }
        }
      ];
      
      mockService.getAllProjects = vi.fn().mockResolvedValue(mockProjects);
      
      const result = await completedResearchProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toContain('Recently Completed Research');
      expect(result.text).toContain('AI ethics');
      expect(result.text).toContain('Report available');
      expect(result.text).toContain('3 sections');
    });
    
    it('should handle no completed projects', async () => {
      mockService.getAllProjects = vi.fn().mockResolvedValue([]);
      
      const result = await completedResearchProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toBe('');
    });
  });
  
  describe('researchCapabilitiesProvider', () => {
    it('should provide research capabilities information', async () => {
      const result = await researchCapabilitiesProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toContain('Research Capabilities');
      expect(result.text).toContain('Deep multi-phase internet research');
      expect(result.text).toContain('Automatic source collection');
      expect(result.text).toContain('Comprehensive report generation');
    });
    
    it('should work even without service', async () => {
      mockRuntime.getService = vi.fn().mockReturnValue(null);
      
      const result = await researchCapabilitiesProvider.get(mockRuntime, mockMemory, mockState);
      
      expect(result.text).toContain('Research Capabilities');
    });
  });
}); 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startResearchAction, checkResearchStatusAction } from '../actions';
import { ResearchService } from '../service';
import { ResearchStatus, ResearchPhase, ResearchProject } from '../types';
import { IAgentRuntime, Memory, HandlerCallback } from '@elizaos/core';

// Mock research project
const mockProject: ResearchProject = {
  id: 'test-project-id',
  query: 'quantum computing breakthroughs',
  status: ResearchStatus.ACTIVE,
  phase: ResearchPhase.SEARCHING,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  findings: [],
  sources: [],
  metadata: {},
};

// Create mock runtime with research service
const createMockRuntime = (service: ResearchService) => ({
  getService: vi.fn((name: string) => {
    if (name === 'research') return service;
    return null;
  }),
  useModel: vi.fn(async () => {
    return JSON.stringify({
      topic: 'quantum computing breakthroughs',
      scope: 'recent advances in 2024',
      maxSources: 15
    });
  }) as any,
} as unknown as IAgentRuntime);

describe('Research Actions', () => {
  let runtime: IAgentRuntime;
  let mockService: ResearchService;
  let mockCallback: HandlerCallback;

  beforeEach(() => {
    mockService = {
      createResearchProject: vi.fn(async () => mockProject),
      getProject: vi.fn(async (id: string) => 
        id === mockProject.id ? mockProject : undefined
      ),
      getAllProjects: vi.fn(async () => [mockProject]),
      getActiveProjects: vi.fn(async () => [mockProject]),
      pauseResearch: vi.fn(async () => {}),
      resumeResearch: vi.fn(async () => {}),
    } as unknown as ResearchService;
    
    runtime = createMockRuntime(mockService);
    mockCallback = vi.fn();
  });

  describe('startResearchAction', () => {
    it('should validate when research service is available', async () => {
      const message = { content: { text: 'Research quantum computing' } } as Memory;
      const isValid = await startResearchAction.validate(runtime, message);
      expect(isValid).toBe(true);
    });

    it('should not validate when research service is unavailable', async () => {
      runtime.getService = vi.fn(() => null);
      const message = { content: { text: 'Research quantum computing' } } as Memory;
      const isValid = await startResearchAction.validate(runtime, message);
      expect(isValid).toBe(false);
    });

    it('should start a research project successfully', async () => {
      const message = { 
        content: { text: 'Research quantum computing breakthroughs in 2024' } 
      } as Memory;
      
      const result = await startResearchAction.handler(
        runtime,
        message,
        undefined,
        {},
        mockCallback
      );

      expect(mockService.createResearchProject).toHaveBeenCalledWith(
        'quantum computing breakthroughs',
        expect.objectContaining({
          maxSearchResults: 15,
          language: 'en'
        })
      );

      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('I\'ve started a deep research project'),
        metadata: { project: mockProject }
      }));

      expect((result as any).metadata.project).toBe(mockProject);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      runtime.useModel = vi.fn(async () => 'invalid json') as any;
      
      const message = { 
        content: { text: 'Research AI impact' } 
      } as Memory;
      
      const result = await startResearchAction.handler(
        runtime,
        message,
        undefined,
        {},
        mockCallback
      );

      expect(mockService.createResearchProject).toHaveBeenCalledWith(
        'Research AI impact',
        expect.objectContaining({
          maxSearchResults: 10,
          language: 'en'
        })
      );
    });
  });

  describe('checkResearchStatusAction', () => {
    it('should check status of most recent project', async () => {
      runtime.useModel = vi.fn(async () => 
        JSON.stringify({ getMostRecent: true })
      ) as any;

      const message = { 
        content: { text: "What's the status of my research?" } 
      } as Memory;
      
      const result = await checkResearchStatusAction.handler(
        runtime,
        message,
        undefined,
        {},
        mockCallback
      );

      expect(mockService.getActiveProjects).toHaveBeenCalled();
      expect((result as any).text).toContain('Research Project Status');
      expect((result as any).text).toContain(mockProject.query);
      expect((result as any).text).toContain(mockProject.phase);
    });

    it('should check status by project ID', async () => {
      runtime.useModel = vi.fn(async () => 
        JSON.stringify({ projectId: 'test-project-id', getMostRecent: false })
      ) as any;

      const message = { 
        content: { text: 'Check status of project test-project-id' } 
      } as Memory;
      
      const result = await checkResearchStatusAction.handler(
        runtime,
        message,
        undefined,
        {},
        mockCallback
      );

      expect(mockService.getProject).toHaveBeenCalledWith('test-project-id');
      expect((result as any).text).toContain('Research Project Status');
    });

    it('should handle no projects found', async () => {
      mockService.getActiveProjects = vi.fn(async () => []);
      runtime.useModel = vi.fn(async () => 
        JSON.stringify({ getMostRecent: true })
      ) as any;

      const message = { 
        content: { text: "Check research status" } 
      } as Memory;
      
      const result = await checkResearchStatusAction.handler(
        runtime,
        message,
        undefined,
        {},
        mockCallback
      );

      expect((result as any).text).toContain('No research projects found');
    });
  });
}); 
import { vi } from 'vitest';

// Mock browserbase plugin if needed
vi.mock('@browserbasehq/stagehand', () => {
  return {
    Stagehand: vi.fn().mockImplementation(() => ({
      init: vi.fn(),
      close: vi.fn(),
      page: {
        goto: vi.fn(),
        waitForLoadState: vi.fn(),
        keyboard: {
          press: vi.fn()
        },
        click: vi.fn(),
        waitForNavigation: vi.fn(),
        evaluate: vi.fn().mockResolvedValue([])
      },
      extract: vi.fn().mockResolvedValue({ results: [] }),
      act: vi.fn()
    }))
  };
});

// Setup any global test configuration
beforeEach(() => {
  vi.clearAllMocks();
}); 
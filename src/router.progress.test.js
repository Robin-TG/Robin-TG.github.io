import { describe, expect, it } from 'vitest';
import { percentFromRouterProgress } from './router.js';

describe('percentFromRouterProgress', () => {
  it('returns null for non-objects', () => {
    expect(percentFromRouterProgress(null)).toBeNull();
    expect(percentFromRouterProgress(undefined)).toBeNull();
    expect(percentFromRouterProgress('x')).toBeNull();
  });

  it('returns 0 for initiate status', () => {
    expect(percentFromRouterProgress({ status: 'initiate' })).toBe(0);
  });

  it('maps unit progress 0–1 to percent', () => {
    expect(percentFromRouterProgress({ progress: 0.5 })).toBe(50);
    expect(percentFromRouterProgress({ progress: 1 })).toBe(100);
  });

  it('maps 0–100 progress', () => {
    expect(percentFromRouterProgress({ progress: 37 })).toBe(37);
    expect(percentFromRouterProgress({ progress: 150 })).toBe(100);
  });

  it('derives percent from loaded and total', () => {
    expect(percentFromRouterProgress({ loaded: 250, total: 1000 })).toBe(25);
    expect(percentFromRouterProgress({ loaded: 1000, total: 1000 })).toBe(100);
  });
});

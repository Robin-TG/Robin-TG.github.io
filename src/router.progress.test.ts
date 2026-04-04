import { describe, expect, it } from 'vitest';
import { percentFromRouterProgress, extractFileProgress } from './router.ts';

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

describe('extractFileProgress', () => {
  it('extracts file and percent from progress object', () => {
    expect(extractFileProgress({ file: 'model.bin', progress: 50 })).toEqual({
      file: 'model.bin',
      percent: 50,
    });
  });

  it('extracts file from loaded/total progress', () => {
    expect(extractFileProgress({ file: 'vocab.json', loaded: 500, total: 1000 })).toEqual({
      file: 'vocab.json',
      percent: 50,
    });
  });

  it('returns undefined file when not present', () => {
    expect(extractFileProgress({ progress: 75 })).toEqual({
      file: undefined,
      percent: 75,
    });
  });

  it('returns 0 percent for invalid input', () => {
    expect(extractFileProgress(null)).toEqual({ percent: 0 });
    expect(extractFileProgress({})).toEqual({ percent: 0 });
  });
});

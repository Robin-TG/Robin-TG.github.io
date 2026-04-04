import { describe, expect, it } from 'vitest';
import { clean, condense } from './routeText.js';

describe('clean (web search query)', () => {
  it('expands btc and kl', () => {
    expect(clean('btc price')).toContain('bitcoin');
    expect(clean('weather in kl')).toContain('kuala');
  });

  it('strips question fluff and keeps topic tokens', () => {
    const out = clean('What is the weather forecast tomorrow please?');
    expect(out).toMatch(/weather|forecast|tomorrow/);
    expect(out.toLowerCase()).not.toContain('what');
  });
});

describe('condense (LLM routing text)', () => {
  it('removes polite prefixes', () => {
    const out = condense('Can you please tell me how photosynthesis works?');
    expect(out.toLowerCase()).toContain('photosynthesis');
    expect(out.toLowerCase()).not.toContain('please');
  });

  it('normalizes how does → how', () => {
    const out = condense('How does a car engine work?');
    expect(out.toLowerCase()).toContain('how');
    expect(out.toLowerCase()).toContain('car');
  });
});

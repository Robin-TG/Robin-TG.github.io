import { describe, expect, it } from 'vitest';
import { clean, condense } from './routeText.ts';

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

  it('removes hanging s after apostrophe from what is', () => {
    const out = clean("What's the weather in Boston");
    expect(out).not.toMatch(/ [s]$/);
    expect(out.toLowerCase()).toContain('weather');
    expect(out.toLowerCase()).not.toContain("what's");
  });

  it('removes whatll contraction without leaving ll', () => {
    const out = clean("what'll weather langkawi next week");
    expect(out).not.toMatch(/ [a-z]$/);
    expect(out.toLowerCase()).toContain('weather');
    expect(out).not.toContain('ll');
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

  it('removes contractions to prevent hanging s', () => {
    const tests = [
      ["What's the weather in Boston", 'weather'],
      ["That's a great idea", 'great'],
      ["Who's there", 'there'],
      ["It's working fine", 'working'],
    ];
    for (const [input, expected] of tests) {
      const out = condense(input);
      expect(out).not.toMatch(/\bs\b/);
      expect(out.toLowerCase()).toContain(expected);
    }
  });

  it('handles multiple contraction artifacts', () => {
    const out = condense("What's the weather's in Boston's forecast");
    expect(out).not.toMatch(/ [s]$/);
    expect(out.toLowerCase()).toContain('weather');
  });

  it('removes all contraction artifacts without hanging letters', () => {
    const out = condense("that'll what's it's who'll");
    expect(out).not.toMatch(/ [a-z]$/);
    expect(out.trim()).toBe('');
  });

  it('handles curly apostrophes', () => {
    const out = condense("what\u2019ll weather in langkawi");
    expect(out.toLowerCase()).toContain('weather');
    expect(out).not.toMatch(/\bs\b/);
  });
});

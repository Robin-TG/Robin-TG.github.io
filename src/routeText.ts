export function clean(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/\bkl\b/g, 'kuala lumpur').replace(/\bbtc\b/g, 'bitcoin');
  t = t.replace(/\b(what is|what's|what are|tell me|show me|can you|please|you know|sort of)\b/gi, '');
  t = t.replace(/\b(what|which|who|when|where|why|how)\b/gi, '');
  t = t.replace(/\b(is|are|was|were|be|been|being)\b/gi, '');
  t = t.replace(/\b(going|gonna|will|would|should|could)\b/gi, '');
  t = t.replace(/\b(right now|currently|at the moment)\b/gi, '');
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  let tokens = t.split(/\s+/).filter(Boolean);
  const stop = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'this', 'that']);
  tokens = tokens.filter((w) => !stop.has(w));
  const priority = [
    'weather',
    'forecast',
    'price',
    'stock',
    'bitcoin',
    'news',
    'score',
    'result',
    'time',
    'date',
    'flight',
    'status',
    'sports',
    'football',
  ];
  tokens.sort((a, b) => {
    const pa = priority.includes(a) ? -1 : 0;
    const pb = priority.includes(b) ? -1 : 0;
    return pa - pb;
  });
  tokens = [...new Set(tokens)];
  tokens = tokens.slice(0, 6);
  return tokens.join(' ');
}

export function condense(text: string): string {
  let t = text.toLowerCase();
  t = t.replace(/\bkl\b/g, 'kuala lumpur').replace(/\bbtc\b/g, 'bitcoin');
  const phrases = [
    'can you',
    'could you',
    'would you',
    'please',
    'tell me',
    'i want to know',
    'do you know',
    'help me',
    'is it possible to',
  ];
  let regex = new RegExp(`\\b(${phrases.join('|')})\\b`, 'gi');
  t = t.replace(regex, '');
  const verbs = ['give', 'provide', 'show', 'list', 'describe', 'elaborate', 'talk about'];
  regex = new RegExp(`\\b(${verbs.join('|')})\\b`, 'gi');
  t = t.replace(regex, '');
  t = t.replace(/\bwhat is\b/g, '');
  t = t.replace(/\bhow does\b/g, 'how');
  t = t.replace(/\bwhy does\b/g, 'why');
  const filler = [
    'actually',
    'basically',
    'generally',
    'in detail',
    'a bit',
    'a little',
    'kind of',
    'sort of',
  ];
  regex = new RegExp(`\\b(${filler.join('|')})\\b`, 'gi');
  t = t.replace(regex, '');
  t = t.replace(/\b(the|a|an|to|of|in|on|for|and|or|it|this|that)\b/gi, '');
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  let tokens = t.split(/\s+/).filter(Boolean);
  tokens = tokens.filter((w) => !w.match(/^(is|are|was|were|be|been)$/));
  tokens = [...new Set(tokens)];
  const intentWords = ['why', 'how', 'difference', 'compare'];
  tokens.sort((a, b) => {
    const pa = intentWords.includes(a) ? -1 : 0;
    const pb = intentWords.includes(b) ? -1 : 0;
    return pa - pb;
  });
  return tokens.join(' ');
}

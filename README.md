# Green Sieve

A voice-enabled chat interface that intelligently routes messages between web search and LLM processing.

## Features

- **Voice Input**: Speak your message and it automatically sends after a short silence
- **Smart Routing**: Uses local ML to determine if a query needs web search or LLM processing
- **Conversation History**: Multiple conversations with local storage persistence
- **Configurable Settings**: Adjust speech silence timeout (500-10000ms)
- **Responsive Design**: Works on desktop and mobile

## Tech Stack

- React 19 with TypeScript
- Vite for build tooling
- Vitest for testing
- Transformers.js for on-device ML (paraphrase-multilingual-MiniLM-L12-v2)
- Web Speech API for voice input

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test        # Run tests in watch mode
npm run test:run # Run tests once
```

## Build

```bash
npm run build
npm run preview # Preview production build
```

## Architecture

- `src/App.tsx` - Main React component
- `src/router.ts` - ML-based intent classification
- `src/routeText.ts` - Text processing utilities
- `src/storage.ts` - LocalStorage persistence
- `src/index.css` - Styling

## Deployment

Deployed to GitHub Pages. Push to `main` branch to auto-deploy.

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SpeechVisualizer from './SpeechVisualizer.tsx';

afterEach(() => {
  cleanup();
});

describe('SpeechVisualizer', () => {
  it('renders null when isVisible is false', () => {
    render(<SpeechVisualizer isVisible={false} />);
    expect(document.querySelector('.speech-visualizer-container')).not.toBeInTheDocument();
  });

  it('renders container when isVisible is true', () => {
    render(<SpeechVisualizer isVisible={true} />);
    const container = document.querySelector('.speech-visualizer-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('speech-visualizer-container');
  });

  it('renders 40 bars inside viz-bars container', () => {
    render(<SpeechVisualizer isVisible={true} />);
    const bars = document.querySelectorAll('.viz-bars > .viz-bar');
    expect(bars).toHaveLength(40);
  });

  it('renders scanline element', () => {
    render(<SpeechVisualizer isVisible={true} />);
    const scanline = document.querySelector('.viz-scanline');
    expect(scanline).toBeInTheDocument();
  });

  it('toggles visibility based on isVisible prop', () => {
    const { rerender } = render(<SpeechVisualizer isVisible={false} />);
    expect(document.querySelector('.speech-visualizer-container')).not.toBeInTheDocument();

    rerender(<SpeechVisualizer isVisible={true} />);
    expect(document.querySelector('.speech-visualizer-container')).toBeInTheDocument();
  });
});

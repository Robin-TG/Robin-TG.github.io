import { useEffect, useRef } from 'react';

interface SpeechVisualizerProps {
  isVisible: boolean;
}

export default function SpeechVisualizer({ isVisible }: SpeechVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;
    const bars = containerRef.current.querySelectorAll<HTMLElement>('.viz-bar');
    bars.forEach((bar, i) => {
      const delay = i * 0.05;
      const duration = 0.3 + Math.random() * 0.2;
      bar.style.animationDelay = `${delay}s`;
      bar.style.animationDuration = `${duration}s`;
    });
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="speech-visualizer-container">
      <div className="viz-bars">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="viz-bar" style={{ '--bar-index': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="viz-scanline" />
    </div>
  );
}

interface SpeechVisualizerProps {
  isVisible: boolean;
}

export default function SpeechVisualizer({ isVisible }: SpeechVisualizerProps) {
  if (!isVisible) return null;

  return (
    <div className="speech-visualizer-container">
      <div className="viz-bars">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="viz-bar" />
        ))}
      </div>
    </div>
  );
}

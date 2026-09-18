"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  label?: string;
  color?: string;
}

export default function AudioVisualizer({
  analyserNode,
  isActive,
  label,
  color = "#a855f7",
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      if (!analyserNode || !isActive) {
        // Draw idle state — gentle sine wave
        const barCount = 40;
        const barWidth = width / barCount - 2;
        const time = Date.now() / 1000;

        for (let i = 0; i < barCount; i++) {
          const idleHeight =
            4 + Math.sin(time * 2 + i * 0.3) * 3 + Math.sin(time * 3 + i * 0.5) * 2;
          const x = i * (barWidth + 2);
          const y = (height - idleHeight) / 2;

          ctx.fillStyle = `${color}33`;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, idleHeight, 2);
          ctx.fill();
        }

        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      const barCount = 40;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = Math.max(4, value * height * 0.8);
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        // Gradient opacity based on height
        const alpha = 0.3 + value * 0.7;
        ctx.fillStyle =
          color +
          Math.round(alpha * 255)
            .toString(16)
            .padStart(2, "0");

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyserNode, isActive, color]);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
          {label}
        </span>
      )}
      <canvas
        ref={canvasRef}
        className="h-16 w-full rounded-xl"
        style={{ width: "100%", height: "64px" }}
      />
    </div>
  );
}

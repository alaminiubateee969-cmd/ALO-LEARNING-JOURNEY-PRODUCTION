"use client";

// Lightweight inline SVG sparkline — no chart library dependency.
// Renders a smooth-ish line from numeric values with gradient fill.
export default function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "#f59e0b",
  fillFrom = "rgba(245, 158, 11, 0.25)",
  fillTo = "rgba(245, 158, 11, 0)",
  strokeWidth = 2,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillFrom?: string;
  fillTo?: string;
  strokeWidth?: number;
}) {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="bg-muted/30 rounded" />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  // Build smooth path (simple line for now; could add bezier)
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor={fillTo} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* last point dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  );
}

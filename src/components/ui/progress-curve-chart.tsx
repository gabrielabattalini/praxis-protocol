import { useId, useMemo } from "react";

type ProgressCurvePoint = {
  label: string;
  value: number;
  helper?: string;
};

type ProgressCurveChartProps = {
  points: ProgressCurvePoint[];
  goalValue?: number;
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  className?: string;
};

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

export function ProgressCurveChart({
  points,
  goalValue,
  valueFormatter = (value) => value.toFixed(1),
  emptyLabel = "Sem dados suficientes para desenhar a curva ainda.",
  className = "",
}: ProgressCurveChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const normalizedPoints = useMemo(
    () => points.map((point) => ({ ...point, value: Number(point.value) || 0 })),
    [points],
  );
  const hasValues = normalizedPoints.some((point) => point.value > 0);
  const width = 100;
  const height = 52;
  const paddingX = 8;
  const paddingY = 6;
  const maxValue = Math.max(
    goalValue ?? 0,
    ...normalizedPoints.map((point) => point.value),
    1,
  );
  const usableHeight = height - paddingY * 2;
  const usableWidth = width - paddingX * 2;
  const chartPoints = normalizedPoints.map((point, index) => {
    const x =
      normalizedPoints.length === 1
        ? width / 2
        : paddingX + (usableWidth / Math.max(1, normalizedPoints.length - 1)) * index;
    const y = height - paddingY - (point.value / maxValue) * usableHeight;
    return { ...point, x, y };
  });
  const linePath = buildLinePath(chartPoints);
  const areaPath = chartPoints.length
    ? `${linePath} L ${chartPoints[chartPoints.length - 1]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} L ${chartPoints[0]?.x.toFixed(2)} ${(height - paddingY).toFixed(2)} Z`
    : "";
  const goalY =
    goalValue && goalValue > 0
      ? height - paddingY - (goalValue / maxValue) * usableHeight
      : null;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
        {hasValues ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
            <defs>
              <linearGradient id={`curve-fill-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={height - paddingY}
              y2={height - paddingY}
              stroke="rgba(63,63,70,0.95)"
              strokeWidth="0.35"
            />

            {goalY !== null ? (
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={goalY}
                y2={goalY}
                stroke="rgba(251,191,36,0.55)"
                strokeDasharray="1.4 1.8"
                strokeWidth="0.42"
              />
            ) : null}

            <path
              d={areaPath}
              fill={`url(#curve-fill-${gradientId})`}
              stroke="none"
            />
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.9"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {chartPoints.map((point) => (
              <g key={`${point.label}-${point.x}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.4"
                  fill="#050505"
                  stroke="var(--accent)"
                  strokeWidth="0.8"
                />
              </g>
            ))}
          </svg>
        ) : (
          <div className="flex h-40 items-center justify-center text-center text-sm text-zinc-500">
            {emptyLabel}
          </div>
        )}
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, normalizedPoints.length)}, minmax(0, 1fr))`,
        }}
      >
        {normalizedPoints.map((point) => (
          <div key={point.label} className="space-y-1 rounded-sm border border-zinc-800 bg-black/20 p-3 text-center">
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-zinc-500">
              {point.label}
            </p>
            <p className="font-headline text-lg font-bold text-zinc-100">
              {valueFormatter(point.value)}
            </p>
            {point.helper ? (
              <p className="text-[0.68rem] leading-5 text-zinc-500">{point.helper}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

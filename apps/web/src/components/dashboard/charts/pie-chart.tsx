"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

interface PieChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

// Fallback colors if CSS variables not available
const FALLBACK_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

export function PieChart({
  data,
  title,
  description,
  className,
  height = 300,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
}: PieChartProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
            labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart(props: PieChartProps) {
  return <PieChart {...props} innerRadius={60} outerRadius={80} />;
}

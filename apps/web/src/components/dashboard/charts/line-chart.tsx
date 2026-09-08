"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  xAxisKey: string;
  title?: string;
  description?: string;
  color?: string;
  className?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showDots?: boolean;
}

export function LineChart({
  data,
  dataKey,
  xAxisKey,
  title,
  description,
  color = "hsl(var(--primary))",
  className,
  height = 300,
  showGrid = true,
  showLegend = false,
  showDots = true,
}: LineChartProps) {
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
        <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
          />
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={showDots ? { r: 4, fill: color } : false}
            activeDot={{ r: 6 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

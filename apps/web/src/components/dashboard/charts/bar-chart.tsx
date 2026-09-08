"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface BarChartProps {
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
}

export function BarChart({
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
}: BarChartProps) {
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
        <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

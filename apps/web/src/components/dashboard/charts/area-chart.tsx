"use client";

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface AreaChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  xAxisKey: string;
  title?: string;
  description?: string;
  color?: string;
  className?: string;
  height?: number;
  showGrid?: boolean;
  gradient?: boolean;
}

export function AreaChart({
  data,
  dataKey,
  xAxisKey,
  title,
  description,
  color = "hsl(var(--primary))",
  className,
  height = 300,
  showGrid = true,
  gradient = true,
}: AreaChartProps) {
  const gradientId = `gradient-${dataKey}`;

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
        <RechartsAreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {gradient && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
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
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={gradient ? `url(#${gradientId})` : color}
            fillOpacity={gradient ? 1 : 0.2}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

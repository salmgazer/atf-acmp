"use client";

import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface DataTableCardProps<T> {
  title?: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTableCard<T extends object>({
  title,
  description,
  columns,
  data,
  className,
  emptyMessage = "No data available",
  loading = false,
}: DataTableCardProps<T>) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const getValue = (row: T, key: string): unknown => {
    return (row as Record<string, unknown>)[key];
  };

  if (loading) {
    return (
      <div className={cn("rounded-lg border bg-card", className)}>
        {(title || description) && (
          <div className="border-b p-6">
            {title && <div className="h-5 w-32 animate-pulse rounded bg-muted" />}
            {description && <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />}
          </div>
        )}
        <div className="p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3">
              {columns.map((_, j) => (
                <div key={j} className="h-4 flex-1 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {(title || description) && (
        <div className="border-b p-6">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                    alignClass[column.align || "left"]
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/50">
                  {columns.map((column) => {
                    const value = getValue(row, String(column.key));
                    return (
                      <td
                        key={String(column.key)}
                        className={cn("px-6 py-4 text-sm", alignClass[column.align || "left"])}
                      >
                        {column.render ? column.render(value, row) : String(value ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

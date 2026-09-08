"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface TablePaginationProps {
  page: number;
  pageSize: PageSize;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  className?: string;
}

export function TablePagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {totalItems > 0 ? (
            <>
              {startItem}-{endItem} of {totalItems}
            </>
          ) : (
            "0 items"
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-1">
          {generatePageNumbers(page, totalPages).map((pageNum, idx) => (
            pageNum === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum as number)}
                className={cn(
                  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors",
                  page === pageNum
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {pageNum}
              </button>
            )
          ))}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Generate page numbers with ellipsis for large page counts
function generatePageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  // Show pages around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

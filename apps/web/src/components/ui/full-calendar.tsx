"use client";

import * as React from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  color?: "default" | "blue" | "green" | "yellow" | "red" | "purple";
  onClick?: () => void;
}

interface FullCalendarProps {
  events?: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

const eventColors = {
  default: "bg-primary/10 text-primary border-l-2 border-primary",
  blue: "bg-blue-100 text-blue-800 border-l-2 border-blue-500 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-800 border-l-2 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300",
  yellow: "bg-amber-100 text-amber-800 border-l-2 border-amber-500 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-800 border-l-2 border-red-500 dark:bg-red-950 dark:text-red-300",
  purple: "bg-purple-100 text-purple-800 border-l-2 border-purple-500 dark:bg-purple-950 dark:text-purple-300",
};

export function FullCalendar({
  events = [],
  onDateClick,
  onEventClick,
  className,
}: FullCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const days = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const dateKey = format(event.date, "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    return map;
  }, [events]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={idx}
              onClick={() => onDateClick?.(day)}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-1 transition-colors",
                !isCurrentMonth && "bg-muted/30",
                isCurrentDay && "bg-blue-50 dark:bg-blue-950/20",
                onDateClick && "cursor-pointer hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium p-1",
                  !isCurrentMonth && "text-muted-foreground/50",
                  isCurrentDay && "text-blue-600 dark:text-blue-400",
                  isCurrentMonth && !isCurrentDay && "text-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      event.onClick?.();
                      onEventClick?.(event);
                    }}
                    className={cn(
                      "w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-opacity hover:opacity-80",
                      eventColors[event.color || "default"]
                    )}
                  >
                    {event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

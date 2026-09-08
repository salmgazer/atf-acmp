"use client";

import { toast } from "sonner";
import {
  Play,
  Pause,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useQueueStatus,
  usePauseQueue,
  useResumeQueue,
} from "@/lib/api/hooks/use-evaluations";

export function QueueStatus() {
  const { data: status, isLoading, mutate: refreshStatus } = useQueueStatus();
  const { trigger: pauseQueue, isMutating: isPausing } = usePauseQueue();
  const { trigger: resumeQueue, isMutating: isResuming } = useResumeQueue();

  const handlePause = async () => {
    try {
      await pauseQueue();
      refreshStatus();
      toast.success("Queue paused");
    } catch (error) {
      toast.error("Failed to pause queue");
    }
  };

  const handleResume = async () => {
    try {
      await resumeQueue();
      refreshStatus();
      toast.success("Queue resumed");
    } catch (error) {
      toast.error("Failed to resume queue");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Queue Status
            {status?.paused ? (
              <Badge variant="secondary">Paused</Badge>
            ) : (
              <Badge variant="default">Active</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshStatus()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {status?.paused ? (
              <Button size="sm" onClick={handleResume} disabled={isResuming}>
                {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Resume
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={handlePause} disabled={isPausing}>
                {isPausing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
                Pause
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-amber-600">
              <Clock className="h-5 w-5" />
              {status?.waiting || 0}
            </div>
            <div className="text-xs text-muted-foreground">Waiting</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              {status?.active || 0}
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600">
              <CheckCircle className="h-5 w-5" />
              {status?.completed || 0}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-destructive">
              <XCircle className="h-5 w-5" />
              {status?.failed || 0}
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {status?.delayed || 0}
            </div>
            <div className="text-xs text-muted-foreground">Delayed</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateThread } from "@/lib/api/hooks/use-forum";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  basePath?: string;
}

export function NewThreadDialog({
  open,
  onOpenChange,
  categoryId,
  basePath = "/app/forum",
}: NewThreadDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createThread = useCreateThread();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (title.length < 5) {
      toast.error("Title must be at least 5 characters");
      return;
    }

    if (content.length < 10) {
      toast.error("Content must be at least 10 characters");
      return;
    }

    try {
      const thread = await createThread.mutateAsync({
        categoryId,
        title: title.trim(),
        content: content.trim(),
      });

      toast.success("Thread created successfully");
      onOpenChange(false);
      setTitle("");
      setContent("");
      router.push(`${basePath}/thread/${thread.id}`);
    } catch (error) {
      toast.error("Failed to create thread");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Thread</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter a descriptive title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Write your post content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createThread.isPending}>
              {createThread.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Thread
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

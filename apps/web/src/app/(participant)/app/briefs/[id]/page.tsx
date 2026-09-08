"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBrief } from "@/lib/api/hooks/use-briefs";
import {
  ArrowLeft,
  Building2,
  Users,
  Layers,
  FileText,
  Loader2,
  Play,
} from "lucide-react";

function BriefDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: brief, isLoading, error } = useBrief(id);

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParticipantLayout>
    );
  }

  if (error || !brief) {
    return (
      <ParticipantLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Brief not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/app/briefs">Back to Briefs</Link>
          </Button>
        </div>
      </ParticipantLayout>
    );
  }

  const spotsLeft = brief.maxTeams - brief.teamsCount;
  const isFull = spotsLeft <= 0;

  return (
    <ParticipantLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold line-clamp-2">{brief.title}</h1>
        </div>

        {/* Video/Image */}
        {brief.videoUrl ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <video
              src={brief.videoUrl}
              controls
              className="w-full h-full object-cover"
              poster={brief.videoThumbnailUrl || brief.imageUrls?.[0]}
            />
          </div>
        ) : brief.imageUrls?.[0] ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={brief.imageUrls[0]}
              alt={brief.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : brief.videoThumbnailUrl ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-muted relative">
            <img
              src={brief.videoThumbnailUrl}
              alt={brief.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/50 rounded-full p-4">
                <Play className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Organization */}
        {brief.organization && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            {brief.organization.logoUrl ? (
              <img
                src={brief.organization.logoUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">{brief.organization.name}</p>
              <p className="text-sm text-muted-foreground">Partner Organization</p>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          {brief.vertical && (
            <Badge variant="secondary">
              <Layers className="mr-1 h-3 w-3" />
              {brief.vertical.name}
            </Badge>
          )}
          {brief.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Spots */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span>
              {brief.teamsCount} / {brief.maxTeams} teams
            </span>
          </div>
          {isFull ? (
            <Badge variant="destructive">Full</Badge>
          ) : (
            <Badge variant="default" className="bg-green-600">
              {spotsLeft} spots available
            </Badge>
          )}
        </div>

        {/* Description */}
        <div>
          <h3 className="font-semibold mb-2">Description</h3>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: brief.description }}
          />
        </div>

        {/* Problem Statement */}
        <div>
          <h3 className="font-semibold mb-2">Problem Statement</h3>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: brief.problemStatement }}
          />
        </div>

        {/* Expected Outcomes */}
        <div>
          <h3 className="font-semibold mb-2">Expected Outcomes</h3>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: brief.expectedOutcomes }}
          />
        </div>

        {/* Resources */}
        {brief.resources && brief.resources.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Resources</h3>
            <div className="space-y-2">
              {brief.resources.map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{resource.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {resource.type}
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="participant">
      <BriefDetailContent id={id} />
    </ProtectedRoute>
  );
}

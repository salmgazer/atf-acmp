"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileText,
  Film,
  Link as LinkIcon,
  Loader2,
  Search,
  Star,
  Layout,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useResources,
  useResourceTags,
  useTrackDownload,
  Resource,
  ResourceType,
} from "@/lib/api/hooks/use-resources";

const typeIcons: Record<ResourceType, typeof FileText> = {
  document: FileText,
  video: Film,
  link: LinkIcon,
  template: Layout,
};

const typeLabels: Record<ResourceType, string> = {
  document: "Document",
  video: "Video",
  link: "Link",
  template: "Template",
};

export function ResourceList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [tag, setTag] = useState<string>("all");

  const { data, isLoading } = useResources({
    search: search || undefined,
    type: type === "all" ? undefined : type,
    tag: tag === "all" ? undefined : tag,
  });
  const { data: tags } = useResourceTags();
  const { trigger: trackDownload } = useTrackDownload();

  const handleDownload = async (resource: Resource) => {
    await trackDownload({ id: resource.id });
    if (resource.accessUrl) {
      window.open(resource.accessUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resource Library</h1>
        <p className="text-muted-foreground">
          Access guides, templates, and learning materials
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as ResourceType | "all")}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="link">Links</SelectItem>
            <SelectItem value="template">Templates</SelectItem>
          </SelectContent>
        </Select>
        {tags && tags.length > 0 && (
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Featured Resources */}
      {data?.resources.some((r) => r.isFeatured) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Featured
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.resources
              .filter((r) => r.isFeatured)
              .map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onDownload={handleDownload}
                  featured
                />
              ))}
          </div>
        </div>
      )}

      {/* All Resources */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {type === "all" ? "All Resources" : typeLabels[type]}
          {data && ` (${data.total})`}
        </h2>
        {data?.resources.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <File className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No resources found</h3>
              <p className="text-sm text-muted-foreground">
                {search || type !== "all" || tag !== "all"
                  ? "Try adjusting your filters"
                  : "Resources will appear here once added"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.resources
              .filter((r) => !r.isFeatured)
              .map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onDownload={handleDownload}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceCard({
  resource,
  onDownload,
  featured = false,
}: {
  resource: Resource;
  onDownload: (resource: Resource) => void;
  featured?: boolean;
}) {
  const Icon = typeIcons[resource.type];

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <Card className={`hover:border-primary/50 transition-colors ${featured ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            featured ? "bg-amber-100 text-amber-600" : "bg-muted"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{resource.title}</h3>
            {resource.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {resource.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {typeLabels[resource.type]}
              </Badge>
              {resource.fileSize && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(resource.fileSize)}
                </span>
              )}
              {resource.vertical && (
                <Badge variant="outline" className="text-xs">
                  {resource.vertical.name}
                </Badge>
              )}
            </div>
            {resource.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {resource.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {resource.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{resource.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => onDownload(resource)}>
            {resource.type === "link" ? (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </>
            ) : resource.type === "video" ? (
              <>
                <Film className="mr-2 h-4 w-4" />
                Watch
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

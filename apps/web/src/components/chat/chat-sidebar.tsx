"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMyChannels,
  type ChannelWithUnread,
  type ChannelType,
} from "@/lib/api/hooks/use-chat";
import {
  Search,
  Users,
  UserCircle,
  Megaphone,
  MessageSquare,
  Hash,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const channelIcons: Record<ChannelType, typeof Hash> = {
  team: Users,
  mentor_team: UserCircle,
  staff: MessageSquare,
  announcement: Megaphone,
  direct: MessageSquare,
};

interface ChatSidebarProps {
  selectedChannelId?: string;
  onSelectChannel: (channelId: string) => void;
}

export function ChatSidebar({ selectedChannelId, onSelectChannel }: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const { data: channels, isLoading } = useMyChannels();

  const filteredChannels = channels?.filter((c) =>
    c.channel.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group channels by type
  const groupedChannels = filteredChannels?.reduce(
    (acc, item) => {
      const type = item.channel.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    },
    {} as Record<ChannelType, ChannelWithUnread[]>
  );

  const typeLabels: Record<ChannelType, string> = {
    team: "Team Channels",
    mentor_team: "Mentor Channels",
    staff: "Staff Channels",
    announcement: "Forum",
    direct: "Direct Messages",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Search */}
      <div className="p-3 border-b overflow-visible">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            className="pl-9 h-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Channel List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {Object.entries(groupedChannels || {}).map(([type, items]) => (
            <div key={type}>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                {typeLabels[type as ChannelType]}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <ChannelItem
                    key={item.channel.id}
                    item={item}
                    isSelected={selectedChannelId === item.channel.id}
                    onSelect={() => onSelectChannel(item.channel.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {filteredChannels?.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No channels found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChannelItem({
  item,
  isSelected,
  onSelect,
}: {
  item: ChannelWithUnread;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = channelIcons[item.channel.type] || Hash;
  const hasUnread = item.unreadCount > 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted",
        hasUnread && !isSelected && "font-semibold"
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", isSelected ? "" : "text-muted-foreground")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm">{item.channel.name}</span>
          {hasUnread && !isSelected && (
            <Badge
              variant="default"
              className="ml-1 h-5 px-1.5 text-xs"
            >
              {item.unreadCount}
            </Badge>
          )}
        </div>
        {item.latestMessage && (
          <div
            className={cn(
              "text-xs truncate",
              isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            <span className="font-medium">{item.latestMessage.senderName}:</span>{" "}
            {item.latestMessage.content}
          </div>
        )}
      </div>
    </button>
  );
}

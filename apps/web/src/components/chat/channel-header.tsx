"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useChannelMembers,
  type ChatChannel,
  type ChannelType,
  type SenderType,
} from "@/lib/api/hooks/use-chat";
import {
  Menu,
  Users,
  UserCircle,
  Megaphone,
  MessageSquare,
  Hash,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const channelIcons: Record<ChannelType, typeof Hash> = {
  team: Users,
  mentor_team: UserCircle,
  staff: MessageSquare,
  announcement: Megaphone,
  direct: MessageSquare,
};

interface ChannelHeaderProps {
  channel: ChatChannel;
  isConnected: boolean;
  onMenuClick: () => void;
}

export function ChannelHeader({
  channel,
  isConnected,
  onMenuClick,
}: ChannelHeaderProps) {
  const [showMembers, setShowMembers] = useState(false);
  const { data: members } = useChannelMembers(channel.id);

  const Icon = channelIcons[channel.type] || Hash;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8"
        onClick={onMenuClick}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Channel icon */}
      <Icon className="h-4 w-4 text-muted-foreground hidden md:block" />

      {/* Channel name */}
      <div className="flex-1 min-w-0">
        <h2 className="font-medium text-sm truncate">{channel.name}</h2>
        {channel.description && (
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            {channel.description}
          </p>
        )}
      </div>

      {/* Connection status indicator */}
      {isConnected ? (
        <Wifi className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
      )}

      {/* Members button */}
      <Sheet open={showMembers} onOpenChange={setShowMembers}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Users className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Channel Members</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-4">
            <div className="space-y-2">
              {members?.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
              {(!members || members.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members found
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface MemberItemProps {
  member: {
    id: string;
    memberId: string;
    memberType: SenderType;
    memberName: string;
    memberAvatarUrl?: string;
    isAdmin: boolean;
  };
}

function MemberItem({ member }: MemberItemProps) {
  const initials = member.memberName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const typeBadgeColors: Record<SenderType, string> = {
    participant: "",
    mentor: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    staff: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    organization: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
    system: "bg-gray-500/20 text-gray-700 dark:text-gray-400",
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
      <Avatar className="h-9 w-9">
        <AvatarImage src={member.memberAvatarUrl} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{member.memberName}</span>
          {member.isAdmin && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Admin
            </Badge>
          )}
        </div>
        {member.memberType !== "participant" && (
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded inline-block mt-0.5",
              typeBadgeColors[member.memberType]
            )}
          >
            {member.memberType}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMyMentorTeams,
  useMyMentorSessions,
  useLogMentorSession,
  type CreateSessionDto,
} from "@/lib/api/hooks/use-mentors";
import {
  ArrowLeft,
  Users,
  FileText,
  ChevronRight,
  Loader2,
  Clock,
  Calendar,
  Building2,
  User,
  Mail,
  MapPin,
  Plus,
  MessageSquare,
  ExternalLink,
  GraduationCap,
  Crown,
  Star,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const roleIcons = {
  lead: Crown,
  co_lead: Star,
  member: User,
};

function TeamDetailContent({ id }: { id: string }) {
  const [showLogSessionDialog, setShowLogSessionDialog] = useState(false);
  const [sessionForm, setSessionForm] = useState<Partial<CreateSessionDto>>({
    teamId: id,
    sessionDate: new Date().toISOString().split("T")[0],
    durationMinutes: 60,
    sessionType: "regular",
    topicsDiscussed: [],
    actionItems: [],
  });
  const [topicInput, setTopicInput] = useState("");
  const [actionInput, setActionInput] = useState("");

  const { data: teams, isLoading } = useMyMentorTeams();
  const { data: sessions, isLoading: sessionsLoading } = useMyMentorSessions(id);
  const logSessionMutation = useLogMentorSession();

  const team = teams?.find((t: any) => t.id === id);

  const handleLogSession = async () => {
    if (!sessionForm.sessionDate || !sessionForm.durationMinutes) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await logSessionMutation.mutateAsync({
        teamId: id,
        sessionDate: new Date(sessionForm.sessionDate).toISOString(),
        durationMinutes: sessionForm.durationMinutes,
        notes: sessionForm.notes,
        topicsDiscussed: sessionForm.topicsDiscussed || [],
        actionItems: sessionForm.actionItems || [],
        teamProgressNotes: sessionForm.teamProgressNotes,
        nextSessionGoals: sessionForm.nextSessionGoals,
        sessionType: sessionForm.sessionType || "regular",
      } as CreateSessionDto);
      toast.success("Session logged successfully");
      setShowLogSessionDialog(false);
      // Reset form
      setSessionForm({
        teamId: id,
        sessionDate: new Date().toISOString().split("T")[0],
        durationMinutes: 60,
        sessionType: "regular",
        topicsDiscussed: [],
        actionItems: [],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to log session");
    }
  };

  const addTopic = () => {
    if (topicInput.trim()) {
      setSessionForm((f) => ({
        ...f,
        topicsDiscussed: [...(f.topicsDiscussed || []), topicInput.trim()],
      }));
      setTopicInput("");
    }
  };

  const addAction = () => {
    if (actionInput.trim()) {
      setSessionForm((f) => ({
        ...f,
        actionItems: [...(f.actionItems || []), actionInput.trim()],
      }));
      setActionInput("");
    }
  };

  if (isLoading) {
    return (
      <MentorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MentorLayout>
    );
  }

  if (!team) {
    return (
      <MentorLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Team not found</p>
          <Button asChild className="mt-4">
            <Link href="/mentor/teams">Back to Teams</Link>
          </Button>
        </div>
      </MentorLayout>
    );
  }

  return (
    <MentorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/mentor/teams">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{team.name}</h1>
              <Badge variant={team.status === "active" ? "default" : "secondary"}>
                {team.status}
              </Badge>
            </div>
            {team.brief && (
              <p className="text-sm text-muted-foreground mt-1">
                {team.brief.title}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Dialog open={showLogSessionDialog} onOpenChange={setShowLogSessionDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Log Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Log Mentoring Session</DialogTitle>
                <DialogDescription>
                  Record details about your session with {team.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={sessionForm.sessionDate}
                      onChange={(e) =>
                        setSessionForm((f) => ({ ...f, sessionDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min) *</Label>
                    <Select
                      value={String(sessionForm.durationMinutes)}
                      onValueChange={(v) =>
                        setSessionForm((f) => ({ ...f, durationMinutes: parseInt(v) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select
                    value={sessionForm.sessionType}
                    onValueChange={(v) =>
                      setSessionForm((f) => ({ ...f, sessionType: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular Check-in</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="review">Progress Review</SelectItem>
                      <SelectItem value="brainstorm">Brainstorming</SelectItem>
                      <SelectItem value="presentation">Presentation Practice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Topics Discussed</Label>
                  <div className="flex gap-2">
                    <Input
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="Add a topic..."
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                    />
                    <Button type="button" variant="outline" onClick={addTopic}>
                      Add
                    </Button>
                  </div>
                  {sessionForm.topicsDiscussed && sessionForm.topicsDiscussed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sessionForm.topicsDiscussed.map((topic, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() =>
                            setSessionForm((f) => ({
                              ...f,
                              topicsDiscussed: f.topicsDiscussed?.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          {topic} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Action Items</Label>
                  <div className="flex gap-2">
                    <Input
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder="Add an action item..."
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAction())}
                    />
                    <Button type="button" variant="outline" onClick={addAction}>
                      Add
                    </Button>
                  </div>
                  {sessionForm.actionItems && sessionForm.actionItems.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sessionForm.actionItems.map((item, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() =>
                            setSessionForm((f) => ({
                              ...f,
                              actionItems: f.actionItems?.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          {item} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Session Notes</Label>
                  <Textarea
                    value={sessionForm.notes || ""}
                    onChange={(e) =>
                      setSessionForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Key takeaways, observations..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Team Progress Notes</Label>
                  <Textarea
                    value={sessionForm.teamProgressNotes || ""}
                    onChange={(e) =>
                      setSessionForm((f) => ({ ...f, teamProgressNotes: e.target.value }))
                    }
                    placeholder="How is the team progressing?"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Goals for Next Session</Label>
                  <Textarea
                    value={sessionForm.nextSessionGoals || ""}
                    onChange={(e) =>
                      setSessionForm((f) => ({ ...f, nextSessionGoals: e.target.value }))
                    }
                    placeholder="What should be achieved by next session?"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowLogSessionDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLogSession} disabled={logSessionMutation.isPending}>
                  {logSessionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Log Session
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" asChild>
            <Link href={`/mentor/chat?team=${id}`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Link>
          </Button>
        </div>

        {/* Brief Info */}
        {team.brief && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Assigned Brief
            </h2>
            <div className="mt-3">
              <h3 className="font-medium">{team.brief.title}</h3>
              {team.brief.organization && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{team.brief.organization.name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team Members */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members ({team.members?.length || 0})
            </h2>
          </div>
          <div className="divide-y">
            {team.members?.map((member: any) => {
              const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || User;
              return (
                <div key={member.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium">
                        {member.participant.firstName[0]}
                        {member.participant.lastName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member.participant.firstName} {member.participant.lastName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          <RoleIcon className="mr-1 h-3 w-3" />
                          {member.role.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{member.participant.email}</span>
                      </div>
                      {member.participant.country && (
                        <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{member.participant.country}</span>
                        </div>
                      )}
                      {member.participant.institution && (
                        <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
                          <GraduationCap className="h-3 w-3" />
                          <span>{member.participant.institution}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Session History */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Session History ({sessions?.length || 0})
            </h2>
          </div>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions?.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No sessions logged yet
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setShowLogSessionDialog(true)}
              >
                Log First Session
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {sessions?.map((session) => (
                <div key={session.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {session.sessionType}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(session.sessionDate), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{session.durationMinutes} min</span>
                    </div>
                  </div>

                  {session.topicsDiscussed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {session.topicsDiscussed.map((topic, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {session.notes && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {session.notes}
                    </p>
                  )}

                  {session.actionItems.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Action Items:
                      </p>
                      <ul className="mt-1 text-sm list-disc list-inside">
                        {session.actionItems.map((item, i) => (
                          <li key={i} className="text-muted-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MentorLayout>
  );
}

export default function MentorTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ProtectedRoute portal="mentor">
      <TeamDetailContent id={id} />
    </ProtectedRoute>
  );
}

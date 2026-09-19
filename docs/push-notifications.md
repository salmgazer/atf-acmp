# Push Notifications

This document describes all push notification scenarios implemented in the ACMP platform using OneSignal.

## Overview

Push notifications are used for high-value, targeted events that require immediate user attention. We deliberately avoid bulk notifications to all 25,000+ users to prevent notification fatigue and maintain engagement quality.

**Provider:** OneSignal  
**External User ID Format:** `{userType}:{userId}` (e.g., `participant:abc123`, `mentor:xyz789`)

## Configuration

### Backend (API)

Environment variables in `apps/api/.env`:

```env
ONESIGNAL_APP_ID=009659bf-1d27-433c-b78f-5109504da7c1
ONESIGNAL_REST_API_KEY=<your-rest-api-key>
```

### Frontend (Web)

Environment variables in `apps/web/.env`:

```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=009659bf-1d27-433c-b78f-5109504da7c1
```

The OneSignal SDK is initialized in `apps/web/src/app/layout.tsx` and user login/logout is managed by `PushNotificationManager` component.

---

## Notification Scenarios

### 1. Team Invitations

**When:** A participant invites another participant to join their team.

| Field | Value |
|-------|-------|
| Recipients | Invited participant |
| Title | `🤝 Team Invitation` |
| Body | `{inviterName} invited you to join team "{teamName}"` |
| URL | `/app/teams` |
| Trigger | `TeamsService.sendInvitation()` |

**File:** `apps/api/src/modules/teams/teams.service.ts`

---

### 2. Team Invitation Accepted

**When:** An invited participant accepts a team invitation.

| Field | Value |
|-------|-------|
| Recipients | Team leader |
| Title | `✅ Invitation Accepted` |
| Body | `{participantName} has joined your team "{teamName}"` |
| URL | `/app/teams` |
| Trigger | `TeamsService.acceptInvitation()` |

**File:** `apps/api/src/modules/teams/teams.service.ts`

---

### 3. Team Invitation Declined

**When:** An invited participant declines a team invitation.

| Field | Value |
|-------|-------|
| Recipients | Team leader |
| Title | `❌ Invitation Declined` |
| Body | `{participantName} declined to join team "{teamName}"` |
| URL | `/app/teams` |
| Trigger | `TeamsService.declineInvitation()` |

**File:** `apps/api/src/modules/teams/teams.service.ts`

---

### 4. Team Chat Message

**When:** A message is sent in a team channel (TEAM or MENTOR_TEAM type).

| Field | Value |
|-------|-------|
| Recipients | All team members except the sender |
| Title | `💬 {senderName} in {teamName}` |
| Body | `{messageContent}` (truncated to 100 chars) |
| URL | `/app/chat` |
| Trigger | `ChatService.sendMessage()` → `sendMessagePushNotifications()` |

**File:** `apps/api/src/modules/chat/chat.service.ts`

**Note:** Only TEAM and MENTOR_TEAM channel types trigger push notifications. Direct messages and other channel types do not.

---

### 5. Mentor Assignment

**When:** A mentor is assigned to a team.

| Field | Value |
|-------|-------|
| Recipients | All team members + the assigned mentor |
| Title (to team) | `🎓 Mentor Assigned` |
| Body (to team) | `{mentorName} has been assigned as your team's mentor` |
| Title (to mentor) | `🎓 New Team Assignment` |
| Body (to mentor) | `You have been assigned to mentor team "{teamName}"` |
| URL | `/app/mentors` |
| Trigger | `MentorsService.assignMentorToTeam()` → `notifyTeamOfMentorAssignment()` |

**File:** `apps/api/src/modules/mentors/mentors.service.ts`

---

### 6. Submission Deadline Reminder

**When:** A stage deadline is approaching and the team hasn't submitted yet.

| Field | Value |
|-------|-------|
| Recipients | All members of teams that haven't submitted |
| Title | `⏰ Submission Deadline: {stageName}` |
| Body | `{timeRemaining}. Don't forget to submit your team's work!` |
| URL | `/app/submissions` |
| Trigger | `DeadlineReminderService.sendDeadlineReminders()` |

**File:** `apps/api/src/modules/submissions/deadline-reminder.service.ts`

**Usage:**

```typescript
// Send reminders for deadlines in 24 hours (call from cron job)
await deadlineReminderService.sendDeadlineReminders(24);

// Send immediate reminder for a specific stage (manual trigger)
await deadlineReminderService.sendImmediateReminder(stageId);
```

**Note:** This service should be called by a scheduled cron job (e.g., hourly) to check for approaching deadlines.

---

### 7. Evaluation Published

**When:** An admin publishes evaluation results for submissions.

| Field | Value |
|-------|-------|
| Recipients | All members of the evaluated team |
| Title | `📊 Evaluation Published` |
| Body | `Your submission for {stageName} has been evaluated! Check your results.` |
| URL | `/app/evaluations` |
| Trigger | `EvaluationsService.publishEvaluations()` |

**File:** `apps/api/src/modules/evaluations/evaluations.service.ts`

---

## Architecture

### Backend Service

The `OneSignalService` (`apps/api/src/modules/notifications/onesignal.service.ts`) provides methods for sending notifications:

```typescript
// Send to specific users by external user ID
await oneSignalService.sendToExternalUserIds(
  ['participant:abc123', 'mentor:xyz789'],
  {
    title: 'Notification Title',
    body: 'Notification body text',
    data: { type: 'custom_type', customField: 'value' },
    url: '/app/destination',
  }
);
```

All push notifications are logged to the console for debugging:

```
[PUSH] Sending to external user IDs: ["participant:abc123"]
[PUSH] Payload: { title: "...", body: "...", ... }
```

### Frontend Integration

1. **SDK Initialization:** OneSignal SDK loads via script in `layout.tsx`
2. **User Login:** `PushNotificationManager` component calls `OneSignal.login(externalUserId)` after authentication
3. **Permission Prompt:** Automatically handled by OneSignal based on app settings
4. **User Logout:** External user ID is cleared on logout

**Files:**
- `apps/web/src/app/layout.tsx` - SDK script and initialization
- `apps/web/src/components/push-notification-manager.tsx` - Auth sync
- `apps/web/src/lib/onesignal.ts` - Helper functions
- `apps/web/src/hooks/use-push-notifications.ts` - React hook

---

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Supported | Full functionality |
| Firefox | ✅ Supported | Full functionality |
| Safari | ✅ Supported | Requires HTTPS |
| Edge | ✅ Supported | Full functionality |
| Brave | ⚠️ Limited | Shields block OneSignal CDN by default |

**Brave Browser:** Users must disable Brave Shields or add an exception for the OneSignal CDN to receive push notifications.

---

## Service Worker

The OneSignal service worker is located at `apps/web/public/OneSignalSDKWorker.js`. This file must be at the root of the public directory for push notifications to work.

---

## Future Considerations

Potential notification scenarios not yet implemented:

1. **Announcement Published** - Notify relevant audience when a new announcement is posted
2. **Brief Selection** - Notify team when their brief is selected/approved
3. **Certificate Available** - Notify participant when their certificate is ready
4. **Peer Review Assigned** - Notify participant when they're assigned to review another team
5. **Forum Reply** - Notify thread author when someone replies

These would need to be evaluated for volume impact before implementation.

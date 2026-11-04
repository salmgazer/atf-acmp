# ACMP User Acceptance Testing - Bug Tracker

Generated from UAT Bug Log review on October 2026.

## Summary

| Status | Count |
|--------|-------|
| ✅ Fixed | 8 |
| 🔧 In Progress | 0 |
| 📋 Confirmed (Code Fix Needed) | 0 |
| 🔍 Needs Manual Verification | 8 |
| ⏳ Deferred / By Design | 1 |

---

## Fixed Bugs

### B-06: No validation of deadline order in cohorts
- **Severity**: High
- **Portal**: Staff Portal
- **Module**: Cohorts
- **Status**: ✅ Fixed
- **Description**: Cohort deadlines can be set in illogical order (e.g., Team Formation End before Brief Selection End)
- **Root Cause**: `cohorts.service.ts` validates team size but NOT deadline chronological order
- **Fix**: Added `validateDeadlineOrder()` method that checks Registration → Team Formation → Brief Selection → Stage 1-3 → Demo Day order

---

### B-20: Team creation allowed after Team Formation deadline
- **Severity**: High
- **Portal**: Participant Portal
- **Module**: Team
- **Status**: ✅ Fixed
- **Description**: Teams can be created even after the Team Formation deadline has passed
- **Root Cause**: `teams.service.ts` create() method doesn't check `cohort.deadlines.teamFormationEnd`
- **Fix**: Added deadline check that throws BadRequestException if team formation deadline has passed

---

### B-03: Search by participant ID returns nothing
- **Severity**: High
- **Portal**: Staff Portal
- **Module**: Participants
- **Status**: ✅ Fixed
- **Description**: Searching for participant ID (e.g., "P003000") returns no results
- **Root Cause**: In `participants.service.ts`, `participantId` search was NOT wrapped in `LOWER()` while other fields were, making it case-sensitive
- **Fix**: Changed `p.participantId LIKE :search` to `LOWER(p.participantId) LIKE :search`

---

### B-04: Brief Status panel ignores Submitted briefs
- **Severity**: Medium
- **Portal**: Staff Portal
- **Module**: Dashboard
- **Status**: ✅ Fixed
- **Description**: Dashboard Brief Status shows 0 for all statuses even when briefs exist
- **Root Cause**: Frontend dashboard doesn't display `briefStats.submitted` - only shows draft, inReview, approved, rejected
- **Fix**: Added "Submitted" to briefStatusData and MiniStat display in staff dashboard

---

### B-14: Raw HTML tags shown in brief previews
- **Severity**: Medium
- **Portal**: Organization Portal
- **Module**: Dashboard
- **Status**: ✅ Fixed
- **Description**: Brief descriptions show raw `<p>` tags instead of rendered text
- **Root Cause**: Organization dashboard displays `{brief.description}` without stripping HTML
- **Fix**: Changed to `brief.description?.replace(/<[^>]*>/g, '').slice(0, 150)`

---

### B-15: Admin 'Add organization' shows applicant message
- **Severity**: Low
- **Portal**: Staff Portal
- **Module**: Organizations
- **Status**: ✅ Fixed
- **Description**: When staff adds an organization, success message says "Registration submitted successfully! We'll review your application shortly."
- **Root Cause**: `useRegisterOrganization()` hook has a message designed for applicants, not staff
- **Fix**: Added optional `successMessage` parameter to hook, staff dialog now passes "Organization added successfully"

---

### B-18: Stage can be submitted with no files and no brief
- **Severity**: Medium
- **Portal**: Participant Portal
- **Module**: Submissions
- **Status**: ✅ Fixed
- **Description**: Submissions can be made with no files if stage requirements aren't configured
- **Root Cause**: Validation only enforces what's in `stage.requirements` - if empty, anything is allowed
- **Fix**: Added minimum validation requiring at least one file, content, GitHub URL, or video URL

---

### B-02: Staff session opening other portals shows blank page
- **Severity**: High
- **Portal**: Staff Portal
- **Module**: Login & Access
- **Status**: ✅ Fixed
- **Description**: Staff user visiting /org/login redirects to /org/dashboard showing blank page
- **Root Cause**: Middleware auto-redirected to dashboard when token exists, but role didn't match portal
- **Fix**: Removed auto-redirect from login pages - allow users to access login page even if they have a token (for switching accounts/portals)

---

## Needs Manual Verification

### B-05: Audit log misses/incorrectly records events
- **Severity**: Medium
- **Portal**: Staff Portal
- **Module**: Audit Logs
- **Status**: 🔍 Needs Manual Verification
- **Description**: Today's Activity shows 0, bulk import shows "0 participants" though 11 exist
- **Technical Notes**: Audit system exists but requires `@Audit()` decorator on each endpoint. Some endpoints may be missing decorators.
- **Manual Check**: Verify audit logs table has correct data; check which endpoints have `@Audit` decorator

---

### B-07: Brief detail header buttons overflow
- **Severity**: Medium
- **Portal**: Staff Portal
- **Module**: Briefs
- **Status**: 🔍 Needs Manual Verification
- **Description**: "Edit Brief" button cut off at right edge at ~1400px width
- **Manual Check**: Test at 1400px viewport width

---

### B-08: Mentor emails duplicate participant emails / mismatch names
- **Severity**: Medium
- **Portal**: Staff Portal
- **Module**: Mentors
- **Status**: 🔍 Needs Manual Verification
- **Description**: Amina Doe = john.doe@example.com; Fuseni Smith = jane.smith@example.com
- **Manual Check**: This appears to be test data issue, not code bug. Verify mentor import/creation logic.

---

### B-09: Team formation preview doesn't show team members
- **Severity**: Medium
- **Portal**: Staff Portal
- **Module**: Cohorts
- **Status**: 🔍 Needs Manual Verification
- **Description**: Only totals shown when running team formation preview
- **Technical Notes**: Backend DOES return `participants` array in `proposedTeams`. May be frontend display issue.
- **Manual Check**: Check if frontend is rendering the participants array from API response

---

### B-10: 'Onboarding' stat doesn't match rows
- **Severity**: Low
- **Portal**: Staff Portal
- **Module**: Participants
- **Status**: 🔍 Needs Manual Verification
- **Description**: Onboarding count shows 0 but rows with "Pending onboarding" exist
- **Technical Notes**: Backend counts `ParticipantStatus.ONBOARDING` status. Check if frontend filters match.
- **Manual Check**: Compare API response for stats vs list; check filter consistency

---

### B-11: Activity charts contradictory / missing Wednesday
- **Severity**: Low
- **Portal**: Staff Portal
- **Module**: Dashboard
- **Status**: 🔍 Needs Manual Verification
- **Description**: Charts show inconsistent data; Wednesday label missing
- **Technical Notes**: Backend `activity.service.ts` correctly iterates all 7 days including Wednesday
- **Manual Check**: Check frontend chart component for rendering issues

---

### B-12: No notifications for new org / new brief
- **Severity**: Low
- **Portal**: Staff Portal
- **Module**: Global UI
- **Status**: 🔍 Needs Manual Verification
- **Description**: Bell shows "No new notifications" when new orgs register or briefs are submitted
- **Technical Notes**: Notification system exists but automatic triggers for these events may not be implemented
- **Manual Check**: Verify if org registration and brief submission should create staff notifications (feature request vs bug)

---

### B-13: Stage weight shows double % and penalty in green
- **Severity**: Low
- **Portal**: Staff Portal
- **Module**: Cohorts
- **Status**: 🔍 Needs Manual Verification
- **Description**: Shows "% 25.00% weight"; penalty displayed in green instead of warning color
- **Manual Check**: Inspect stage display component for formatting issue

---

## UI/Visual Issues (Manual Verification Required)

### B-24: Red block overlays login image
- **Severity**: Low
- **Portal**: All Portals
- **Module**: Login & Access
- **Status**: 🔍 Needs Manual Verification
- **Description**: Solid red rectangle covers part of login background image
- **Manual Check**: Inspect CSS in login-layout.tsx

---

## Behavioral / Design Clarification Needed

### B-16: Leaderboard says no active challenge
- **Severity**: Medium
- **Portal**: Participant Portal
- **Module**: Leaderboard
- **Status**: 🔍 Needs Manual Verification
- **Description**: Leaderboard shows "No Active Challenge" message
- **Technical Notes**: Leaderboard visibility controlled by `cohort.leaderboardConfig.isPublic` (defaults to false)
- **Manual Check**: Check if cohort has `isPublic: true` in leaderboard config; may be config issue not code bug

---

### B-17: Staff announcements not shown to participants
- **Severity**: Medium
- **Portal**: Participant Portal
- **Module**: Announcements
- **Status**: 🔍 Needs Manual Verification
- **Description**: Announcements posted by staff not visible to participants
- **Technical Notes**: `AnnouncementAudience` enum has ALL, VERTICAL, TEAM, ORGANIZATION, MENTOR. Staff announcements may intentionally be staff-only.
- **Manual Check**: Clarify intended behavior - should staff announcements target participants? Check audience type used.

---

### B-19: Mentor page stale after creating team; no mentors listed
- **Severity**: Medium
- **Portal**: Participant Portal
- **Module**: Mentorship
- **Status**: 🔍 Needs Manual Verification
- **Description**: After creating team, Mentor page shows "Join a Team First", then after reload "No mentors available"
- **Manual Check**: Check if mentors are assigned to cohort; verify cache invalidation after team creation

---

### B-21: Upcoming Deadlines always empty
- **Severity**: Low
- **Portal**: Participant Portal
- **Module**: Dashboard
- **Status**: 🔍 Needs Manual Verification
- **Description**: Dashboard shows empty Upcoming Deadlines section
- **Technical Notes**: Requires `cohort.deadlines` to be configured with future dates. Code conditionally shows deadlines based on user's progress (no team → team formation, has team → brief selection, etc.)
- **Manual Check**: Verify cohort has deadlines configured; check if dates are in the future

---

### B-22: Availability list doesn't refresh after adding a slot
- **Severity**: Medium
- **Portal**: Mentor Portal
- **Module**: Availability
- **Status**: 🔍 Needs Manual Verification
- **Description**: New availability slot not shown until page reload
- **Technical Notes**: Frontend correctly calls `queryClient.invalidateQueries({ queryKey: ["my-availability"] })` on success
- **Manual Check**: Check if mutation is completing successfully; check for stale cache issue

---

### B-23: Contradictory explanations of how mentors get teams
- **Severity**: Medium
- **Portal**: Mentor Portal
- **Module**: Teams
- **Status**: 🔍 Needs Manual Verification
- **Description**: Different pages say "assigned by staff" vs "booked sessions" vs "claimed you"
- **Manual Check**: UX copy review needed - may need consistent messaging across mentor and participant portals

---

## Deferred / By Design

### B-01: Initial participant password = sequential participant ID
- **Severity**: Critical (reported)
- **Status**: ⏳ By Design
- **Description**: Password is the participant ID (P001000, P002000…)
- **Notes**: Client confirmed this is intentional design decision

---

## Change Log

| Date | Bug ID | Action | Notes |
|------|--------|--------|-------|
| 2026-10-09 | All | Initial triage | Bugs categorized from UAT review |

# ATF ACMP Admin Manual

This manual provides comprehensive guidance for administrators managing the ATF AI-Challenge Management Platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Cohort Management](#cohort-management)
4. [Participant Management](#participant-management)
5. [Organization Management](#organization-management)
6. [Mentor Management](#mentor-management)
7. [Brief Review Workflow](#brief-review-workflow)
8. [Team Management](#team-management)
9. [Stage & Submission Management](#stage--submission-management)
10. [AI Evaluation System](#ai-evaluation-system)
11. [Peer Review Management](#peer-review-management)
12. [Certificate Generation](#certificate-generation)
13. [Announcements](#announcements)
14. [Forum Moderation](#forum-moderation)
15. [Common Admin Tasks](#common-admin-tasks)

---

## Getting Started

### Accessing the Admin Portal

1. Navigate to the staff portal URL (e.g., `https://admin.acmp.example.com`)
2. Log in with your admin credentials
3. You'll be directed to the main dashboard

### User Roles

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full system access, user management, system configuration |
| **Program Manager** | Cohort management, participant/mentor management, evaluations |
| **Evaluator** | View submissions, conduct evaluations, manage scores |
| **Viewer** | Read-only access to dashboards and reports |

---

## Dashboard Overview

The admin dashboard provides at-a-glance metrics:

- **Active Cohort Status** - Current phase and timeline
- **Participant Statistics** - Total, active, by country
- **Team Statistics** - Formed teams, average size, status breakdown
- **Submission Progress** - By stage, completion rates
- **Pending Actions** - Briefs to review, evaluations to complete

### Key Metrics

- **Participants**: Total registered, onboarded, assigned to teams
- **Teams**: Total, by status (forming, active, submitted, evaluated)
- **Organizations**: Total, approved, pending review
- **Briefs**: Submitted, approved, pending review
- **Submissions**: By stage, completion percentage

---

## Cohort Management

A cohort represents a single challenge cycle (e.g., "ATF AI Challenge 2026").

### Creating a New Cohort

1. Navigate to **Cohorts** → **Create New**
2. Fill in required fields:
   - **Name**: e.g., "ATF AI Challenge 2026"
   - **Description**: Challenge overview
   - **Start Date**: When the cohort begins
   - **End Date**: Final deadline
   - **Team Size**: Min (3) and Max (5) members
3. Click **Create Cohort**

The cohort is created in **DRAFT** status.

### Cohort Statuses

| Status | Description | Allowed Actions |
|--------|-------------|-----------------|
| **DRAFT** | Initial setup, not visible to participants | Edit, configure, delete |
| **ACTIVE** | Live cohort, participants can join and form teams | Monitor, manage teams |
| **EVALUATION** | Challenge ended, evaluation in progress | Run evaluations, review |
| **COMPLETED** | All evaluations done, results published | Generate certificates |
| **ARCHIVED** | Historical record | View only |

### Activating a Cohort

1. Go to **Cohorts** → Select cohort
2. Review all configuration is complete
3. Click **Activate Cohort**
4. Confirm the action

**Note**: Only one cohort can be ACTIVE at a time.

### Configuring Verticals

Verticals are challenge categories (e.g., Healthcare, Education, Environment).

1. Go to cohort settings → **Verticals**
2. Click **Add Vertical**
3. Enter:
   - Name
   - Description
   - Icon (optional)
4. Repeat for all verticals

### Duplicating a Cohort

To create a new cohort based on an existing one:

1. Go to **Cohorts** → Select source cohort
2. Click **Duplicate**
3. Enter new cohort name
4. The new cohort is created in DRAFT with all settings copied

---

## Participant Management

### Importing Participants

Participants are imported via CSV file.

#### CSV Format

```csv
participant_id,email,first_name,last_name,country,institution,phone_number
ATF2026-001,john.doe@email.com,John,Doe,Kenya,University of Nairobi,+254700000001
ATF2026-002,jane.smith@email.com,Jane,Smith,Nigeria,Lagos State University,+234800000002
```

#### Import Steps

1. Navigate to **Participants** → **Import**
2. Select the target cohort
3. Upload CSV file
4. Review the preview (first 10 rows)
5. Click **Import**
6. Monitor import progress

#### Import Validation

The system validates:
- Required fields (participant_id, email, first_name, last_name, country)
- Email format
- Unique participant_id and email within cohort
- Country code validity

### Viewing Participants

1. Go to **Participants**
2. Use filters:
   - Cohort
   - Status (imported, active, onboarding, ready, assigned)
   - Country
   - Search by name/email

### Participant Statuses

| Status | Description |
|--------|-------------|
| **IMPORTED** | Just imported, not yet logged in |
| **ACTIVE** | Logged in at least once |
| **ONBOARDING** | Completing profile setup |
| **READY** | Ready for team formation |
| **ASSIGNED** | Assigned to a team |
| **INACTIVE** | Deactivated account |

### Managing Individual Participants

Click on a participant to:
- View profile details
- See team assignment
- View submission history
- Send notification
- Deactivate account

### Bulk Actions

Select multiple participants for:
- Send bulk notification
- Export to CSV
- Change status

---

## Organization Management

Organizations submit problem briefs for teams to solve.

### Organization Registration Flow

1. Organization registers via public form
2. Admin reviews application
3. Admin approves or rejects
4. If approved, organization can submit briefs

### Reviewing Organization Applications

1. Go to **Organizations** → **Pending Review**
2. Click on an organization
3. Review:
   - Company information
   - Contact details
   - Problem statement preview
   - Supporting documents
4. Click **Approve** or **Reject**
5. If rejecting, provide reason

### Approved Organizations

Approved organizations can:
- Submit briefs
- Access organization portal
- Receive team match notifications
- View team progress

### Organization Statuses

| Status | Description |
|--------|-------------|
| **PENDING** | Awaiting review |
| **APPROVED** | Can submit briefs |
| **REJECTED** | Application denied |
| **ACTIVE** | Has active briefs |
| **INACTIVE** | Deactivated |

---

## Mentor Management

### Importing Mentors

Mentors are imported via CSV similar to participants.

#### CSV Format

```csv
email,first_name,last_name,expertise,bio,linkedin_url,max_teams
mentor1@email.com,Alice,Johnson,"AI, Machine Learning",Senior data scientist with 10 years experience,https://linkedin.com/in/alice,3
mentor2@email.com,Bob,Williams,"Product Design, UX",Product lead at tech startup,https://linkedin.com/in/bob,2
```

#### Import Steps

1. Navigate to **Mentors** → **Import**
2. Select cohort
3. Upload CSV
4. Review and confirm

### Mentor Assignment

Mentors can be assigned to teams:

#### Manual Assignment

1. Go to **Mentors** → Select mentor
2. Click **Assign to Team**
3. Select team(s)
4. Confirm assignment

#### Auto-Assignment

1. Go to **Mentors** → **Auto-Assign**
2. Configure matching criteria:
   - Expertise alignment
   - Team vertical
   - Mentor capacity
3. Preview assignments
4. Confirm

### Mentor Portal Access

Mentors receive:
- Magic link login (no password)
- Access to assigned team information
- Ability to provide feedback
- Chat with team members

---

## Brief Review Workflow

Briefs are problem statements submitted by organizations.

### Brief Statuses

| Status | Description |
|--------|-------------|
| **DRAFT** | Organization is still editing |
| **SUBMITTED** | Ready for admin review |
| **IN_REVIEW** | Admin is reviewing |
| **CHANGES_REQUESTED** | Needs revision |
| **APPROVED** | Available for team selection |
| **REJECTED** | Not suitable for challenge |

### Reviewing Briefs

1. Go to **Briefs** → **Pending Review**
2. Click on a brief to review
3. Evaluate against criteria:
   - Problem clarity
   - Scope appropriateness
   - Data availability
   - Ethical considerations
4. Choose action:

#### Approve Brief

1. Click **Approve**
2. Brief becomes available for team selection

#### Request Changes

1. Click **Request Changes**
2. Provide specific feedback:
   - What needs to change
   - Why it's needed
   - Suggestions for improvement
3. Organization receives notification

#### Reject Brief

1. Click **Reject**
2. Provide reason
3. Organization receives notification

### Brief Revision History

View all changes to a brief:

1. Open brief details
2. Click **Revision History**
3. See all versions with timestamps

---

## Team Management

### Team Formation

Teams can form through:

1. **Self-formation**: Participants create/join teams using invite codes
2. **Auto-matching**: System matches participants based on preferences

### Viewing Teams

1. Go to **Teams**
2. Filter by:
   - Cohort
   - Status
   - Vertical
   - Brief assignment
   - Search

### Team Statuses

| Status | Description |
|--------|-------------|
| **FORMING** | Team created, recruiting members |
| **ACTIVE** | Team complete, working on challenge |
| **SUBMITTED** | Final submission made |
| **EVALUATED** | Scores assigned |
| **DISQUALIFIED** | Removed from competition |

### Team Actions

For each team, you can:

- **View Details**: Members, submissions, evaluations
- **Assign Brief**: Manually assign a problem brief
- **Assign Mentor**: Assign a mentor
- **Change Status**: Update team status
- **Send Notification**: Contact team members
- **Disqualify**: Remove from competition (with reason)

### Running Auto-Match

1. Go to **Teams** → **Auto-Match**
2. Select cohort
3. Configure parameters:
   - Minimum team size
   - Country diversity preference
   - Skill balancing
4. Click **Preview Matches**
5. Review proposed teams
6. Click **Create Teams**

---

## Stage & Submission Management

### Creating Stages

Stages are submission milestones (e.g., Proposal, MVP, Final).

1. Go to **Stages** → **Create**
2. Fill in:
   - **Name**: e.g., "Stage 1: Proposal"
   - **Description**: What teams should submit
   - **Start Date**: When submissions open
   - **Deadline**: Submission deadline
   - **Weight**: Percentage of total score
   - **Requirements**: What to include
3. Click **Create Stage**

### Stage Settings

For each stage, configure:

- **Submission Types**: Document, GitHub link, video, etc.
- **Required Fields**: Which fields are mandatory
- **Late Submission**: Allow with penalty or not
- **Evaluation Criteria**: Rubric for scoring

### Viewing Submissions

1. Go to **Submissions**
2. Filter by:
   - Stage
   - Status (draft, submitted, evaluated)
   - Team

### Submission Review

1. Click on a submission
2. View:
   - Submitted content
   - GitHub analysis (if applicable)
   - Submission history
   - Evaluation scores
3. Actions:
   - Trigger AI evaluation
   - Add human evaluation
   - Request resubmission

---

## AI Evaluation System

### How AI Evaluation Works

1. Team submits work
2. Admin triggers evaluation
3. System analyzes:
   - Document content
   - GitHub repository (code quality, commits)
   - Video presentation (if applicable)
4. AI generates scores and feedback
5. Human evaluator reviews and adjusts

### Triggering Evaluations

#### Single Team

1. Go to **Submissions** → Select submission
2. Click **Run AI Evaluation**
3. Monitor progress

#### Batch Evaluation

1. Go to **Evaluations** → **Trigger Batch**
2. Select cohort and stage
3. Filter teams (optional)
4. Click **Start Batch Evaluation**
5. Monitor queue status

### Queue Management

1. Go to **Evaluations** → **Queue**
2. View:
   - Pending jobs
   - Processing jobs
   - Completed jobs
   - Failed jobs
3. Actions:
   - Pause queue
   - Resume queue
   - Retry failed jobs
   - Clear queue

### Human Evaluation

1. Go to **Evaluations** → Select evaluation
2. Review AI scores
3. Add human scores:
   - Rate each criterion (1-10)
   - Provide written feedback
4. Adjust AI weight (default 70% AI, 30% human)
5. Click **Save Evaluation**

### Publishing Results

1. Go to **Evaluations** → **Publish**
2. Select evaluations to publish
3. Click **Publish Selected**
4. Teams can now view their scores

---

## Peer Review Management

### Setting Up Peer Reviews

1. Go to **Peer Reviews** → **Rubrics**
2. Create rubric for stage:
   - Criteria (e.g., Innovation, Feasibility)
   - Weight for each criterion
   - Description and guidelines
3. Save rubric

### Assigning Peer Reviews

1. Go to **Peer Reviews** → **Assign**
2. Select cohort and stage
3. Configure:
   - Reviews per team (recommended: 3)
   - Exclude same-vertical teams (optional)
4. Click **Generate Assignments**
5. Review and confirm

### Monitoring Peer Reviews

1. Go to **Peer Reviews** → **Monitor**
2. View:
   - Completion rate
   - Outstanding reviews
   - Flagged reviews
3. Send reminders to incomplete reviewers

### Flagged Reviews

Reviews can be flagged for:
- Inappropriate content
- Suspected bias
- Incomplete feedback

1. Go to **Peer Reviews** → **Flagged**
2. Review the flagged content
3. Take action:
   - Remove flag (false positive)
   - Exclude from scoring
   - Contact reviewer

---

## Certificate Generation

### Certificate Types

- **Participation**: All qualifying teams
- **Completion**: Teams that submitted all stages
- **Winner**: Top performers
- **Special Recognition**: Category awards

### Generating Certificates

1. Go to **Certificates** → **Generate**
2. Select cohort
3. Choose certificate type
4. Configure:
   - Template
   - Signatories
   - Date
5. Preview certificates
6. Click **Generate All**

### Certificate Templates

1. Go to **Certificates** → **Templates**
2. Edit template:
   - Logo placement
   - Text formatting
   - Signature positions
3. Save template

### Distributing Certificates

1. Go to **Certificates** → **Distribute**
2. Select certificates
3. Choose method:
   - Email to participants
   - Download as ZIP
   - Enable self-download

---

## Announcements

### Creating Announcements

1. Go to **Announcements** → **Create**
2. Fill in:
   - **Title**: Clear, concise title
   - **Content**: Announcement body (supports markdown)
   - **Priority**: Normal, Important, Urgent
   - **Target Audience**: All, Participants, Mentors, Organizations
   - **Cohort**: Specific cohort or all
3. Options:
   - **Pin**: Keep at top
   - **Send Email**: Also send via email
   - **Schedule**: Publish later
4. Click **Publish** or **Schedule**

### Managing Announcements

- **Edit**: Update content
- **Pin/Unpin**: Control visibility
- **Archive**: Hide but keep record
- **Delete**: Permanently remove

---

## Forum Moderation

### Forum Categories

1. Go to **Forum** → **Categories**
2. Create categories:
   - General Discussion
   - Technical Help
   - Team Formation
   - Announcements
3. Set permissions for each category

### Moderation Actions

#### Pin Thread

1. Find thread
2. Click **Pin**
3. Thread stays at top of category

#### Lock Thread

1. Find thread
2. Click **Lock**
3. No new replies allowed

#### Delete Content

1. Find thread/reply
2. Click **Delete**
3. Content is removed

### Handling Reports

1. Go to **Forum** → **Reports**
2. Review reported content
3. Take action:
   - Dismiss report
   - Delete content
   - Warn user
   - Ban user (temporary/permanent)

---

## Common Admin Tasks

### Resending Welcome Emails

1. Go to **Participants**
2. Select participant(s)
3. Click **Resend Welcome Email**

### Resetting Participant Password

1. Go to **Participants** → Select participant
2. Click **Reset Password**
3. Participant receives reset link via email

### Extending Deadlines

1. Go to **Stages** → Select stage
2. Click **Edit**
3. Update deadline
4. Save changes

### Exporting Data

#### Export Participants

1. Go to **Participants**
2. Apply filters (optional)
3. Click **Export CSV**

#### Export Teams

1. Go to **Teams**
2. Apply filters
3. Click **Export CSV**

#### Export Evaluation Results

1. Go to **Evaluations**
2. Select cohort and stage
3. Click **Export Results**

### Viewing Activity Logs

1. Go to **Settings** → **Activity Logs**
2. Filter by:
   - User
   - Action type
   - Date range
3. View detailed logs

### System Health Check

1. Go to **Settings** → **System Health**
2. View:
   - Database status
   - Redis status
   - Queue status
   - Storage usage
   - API response times

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G` then `D` | Go to Dashboard |
| `G` then `P` | Go to Participants |
| `G` then `T` | Go to Teams |
| `G` then `S` | Go to Submissions |
| `/` | Global search |
| `?` | Show all shortcuts |

### Status Color Codes

- 🟢 Green: Active/Approved/Completed
- 🟡 Yellow: Pending/In Progress
- 🔴 Red: Error/Rejected/Overdue
- ⚪ Gray: Draft/Inactive

### Support Contacts

- Technical Issues: tech-support@atf.org
- Program Questions: program@atf.org
- Emergency: +1-XXX-XXX-XXXX

---

*Last updated: July 2026*

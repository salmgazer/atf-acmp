# Organization Onboarding & Brief Submission — Task Breakdown

**Feature:** Public multi-step form for organization registration + opportunity brief submission  
**Replaces:** Google Apps Script form (Code.gs + Form.html)  
**Route:** `/onboard` (public, no auth required)  
**Shareable URL:** `https://[domain]/onboard`

---

## ⚠️ IMPORTANT: Database Migration Rule

**ALL schema changes MUST be done via TypeORM migration files.**

Do NOT modify entity files alone — create a migration first, then update the entity to match.

See: `.kiro/steering/database-rules.md`

---

## Overview

A **publicly accessible page** (no login required) where organizations can:
1. Watch an intro video and start the process
2. Register their organization details with consent
3. Choose how many opportunities to submit (1-3)
4. For each opportunity: describe it, answer suitability questions, see fit indicator
5. Submit all briefs and receive confirmation

**Public Access Requirements:**
- Page must be accessible without authentication
- URL can be shared on social media, email campaigns, partner websites
- No user account creation required
- Session tracked via UUID (not user ID)
- Form state persisted to localStorage for recovery

The form replicates the exact UX from the Google Apps Script form with the same scoring algorithm.

---

## Form Flow (5 Screens)

```
[S0: Welcome] → [S1: Organization] → [S2: How Many?] → [S3: Opportunity (×N)] → [S4: Transition] → [S5: Summary]
```

### Screen 0: Welcome
- ATF AI Challenge branding
- Intro text explaining the brief process
- Embedded YouTube video (Zad2WCdv9WA)
- "Get started" button

### Screen 1: Organization Details
- Organization name *
- Sector dropdown * (Healthcare, Agriculture, Finance, Local/Municipal Government, Education, Legal services, Retail/SME, Logistics, Manufacturing, Other)
- Sector Other text field (conditional)
- Country dropdown * (Ghana, Nigeria, Kenya, South Africa)
- City/Town *
- Your name *
- Your designation *
- Department (optional)
- Email *
- Phone * (placeholder updates based on country)
- Consent checkbox with privacy text *

### Screen 2: How Many Opportunities
- Instruction text
- 1 / 2 / 3 button selector

### Screen 3: Opportunity Details (Repeated per opportunity)
- Progress dots showing current/total
- **The Opportunity section:**
  - Title *
  - Description textarea * ("The opportunity and who it affects")
- **Impact Goal section:**
  - What changes * ("If this is addressed, what changes?")
  - How many people *
- **Data and Access section:**
  - Data description textarea *
  - Data sharing radio (4 options) *
- **Named Contact section:**
  - Contact name *
  - Contact role *
  - Contact email *
  - Contact phone *
- **Suitability Check section (Q1-Q6):**
  - Q1: Task nature (5 options)
  - Q2: Data availability (3 options)
  - Q3: Training complexity (3 options)
  - Q4: Tolerance for errors (2 options)
  - Q5: Impact clarity (2 options)
  - Q6: Frequency (2 options)
- **Impact section (Q7-Q8, appears after Q6):**
  - Q7: Depth of change (3 options)
  - Q8: Breadth of impact (3 options)
- **Verdict thermometer (appears after Q8):**
  - Score indicator 0-100
  - Gradient bar from grey → pink → red
  - Neutral message about review

### Screen 4: Transition (between opportunities)
- "Great — your [first/second] brief is recorded"
- "Next opportunity" button

### Screen 5: Summary
- Success message with count
- List of submitted briefs with titles
- Note about country lead review

---

## Phase 1: Database Schema Updates

### 1.1 Brief Entity Extensions
- [ ] Add `fitScore` field (integer, 0-100)
- [ ] Add `fitBand` field (enum: STRONG_FIT, PROMISING, DIFFERENT_SOLUTION, OVERRIDE_DIGITISE, OVERRIDE_COLLECT_DATA, OVERRIDE_SIMPLER_TOOL)
- [ ] Add `scoreOverride` field (string, nullable)
- [ ] Add `depthScore` field (integer 1-3, nullable)
- [ ] Add `breadthScore` field (integer 1-3, nullable)
- [ ] Add `impactScore` field (integer 1-9, nullable - depth × breadth)
- [ ] Add `impactBand` field (enum: HIGH_IMPACT, MODERATE_IMPACT, LOWER_IMPACT)
- [ ] Add `countryLeadNotes` field (text, nullable)
- [ ] Add `sessionId` field (string - for duplicate detection)
- [ ] Add `opportunityNumber` field (integer - sequence within session)
- [ ] Add `whatChanges` field (text - impact goal)
- [ ] Add `affectedCount` field (string - "roughly how many people")
- [ ] Add `dataDescription` field (text)
- [ ] Add `dataAccess` field (string - sharing option selected)
- [ ] Add `secondaryContact` JSON field (name, role, email, phone)

### 1.2 Brief Scoring Questions Storage
- [ ] Add `scoringAnswers` JSON field to Brief entity:
  ```typescript
  {
    q1: string; // routine | judgement | sense_making | no_system | new_capability
    q2: string; // good_records | partial | very_little
    q3: string; // straightforward | mixed | hard
    q4: string; // yes | no_exact
    q5: string; // clear | vague
    q6: string; // very_often | now_and_then
    q7: string; // convenient | meaningful | transformative (depth)
    q8: string; // local | thousands | national (breadth)
    // Store human-readable text versions too
    q1_text?: string;
    q2_text?: string;
    // ... etc
  }
  ```

### 1.3 Organization Entity Extensions
- [ ] Add `city` field (string)
- [ ] Add `sector` field (string) - if not exists
- [ ] Add `sectorOther` field (string, nullable - when sector is "Other")
- [ ] Add `submitterName` field (string - person completing form)
- [ ] Add `submitterDesignation` field (string)
- [ ] Add `submitterDepartment` field (string, nullable)
- [ ] Add `publicSubmission` field (boolean - true if registered via public form)
- [ ] Add `consentGiven` field (boolean)
- [ ] Add `consentTimestamp` field (datetime)

### 1.4 Migration (REQUIRED FIRST)
- [ ] Create migration file: `npm run migration:generate -- -n AddPublicSubmissionFields`
- [ ] Add all new columns to `organization` table
- [ ] Add all new columns to `brief` table
- [ ] Write `down()` method to rollback changes
- [ ] Test migration locally
- [ ] Update entity files to match migration
- [ ] Run migration on staging after deploy

---

## Phase 2: API Endpoints

### 2.1 Public Submission Endpoint
- [ ] POST `/public/organization-briefs` — Create organization + briefs in one transaction
  - No auth required (public endpoint)
  - Request body:
    ```typescript
    {
      sessionId: string;  // UUID generated on form load
      organization: {
        name: string;
        sector: string;
        sectorOther?: string;
        country: string;  // Ghana | Nigeria | Kenya | South Africa
        city: string;
        submitterName: string;
        designation: string;
        department?: string;
        email: string;
        phone: string;
        consentGiven: boolean;
      };
      totalOpportunities: number;  // 1-3
      opportunities: Array<{
        title: string;
        description: string;        // "The opportunity and who it affects"
        whatChanges: string;        // "If addressed, what changes?"
        howMany: string;            // "Roughly how many people?"
        dataDescription: string;    // "Records and data that exist"
        dataAccess: string;         // Selected sharing option text
        contact2Name: string;
        contact2Role: string;
        contact2Email: string;
        contact2Phone: string;
        // Scoring answers (keys)
        q1: string;
        q2: string;
        q3: string;
        q4: string;
        q5: string;
        q6: string;
        q7: string;
        q8: string;
        // Scoring answers (text labels for export)
        q1_text: string;
        q2_text: string;
        q3_text: string;
        q4_text: string;
        q5_text: string;
        q6_text: string;
        q7_text: string;
        q8_text: string;
      }>;
    }
    ```
  - Response: `{ success: boolean; organizationId?: string; briefIds?: string[]; duplicate?: boolean; error?: string }`

### 2.2 Scoring Service
- [ ] Create `BriefScoringService` with methods:
  - `calculateFitScore(answers)` — Sum Q1-Q6 scores (max 100)
  - `getScoreOverride(answers)` — Check override conditions
  - `getFitBand(score, override)` — Determine fit band
  - `calculateDepthScore(q7)` — 1-3
  - `calculateBreadthScore(q8)` — 1-3
  - `calculateImpactScore(depth, breadth)` — depth × breadth (1-9)
  - `getImpactBand(impactScore)` — High/Moderate/Lower

### 2.3 Scoring Constants (exact match to Google Apps Script)
```typescript
const Q_SCORES = {
  q1: { routine: 0, judgement: 25, sense_making: 25, no_system: 0, new_capability: 25 },
  q2: { good_records: 25, partial: 12, very_little: 0 },
  q3: { straightforward: 0, mixed: 10, hard: 15 },
  q4: { yes: 10, no_exact: 0 },
  q5: { clear: 15, vague: 5 },
  q6: { very_often: 10, now_and_then: 3 }
};

const DEPTH_SCORES = { convenient: 1, meaningful: 2, transformative: 3 };
const BREADTH_SCORES = { local: 1, thousands: 2, national: 3 };

// Override conditions
function getOverride(answers) {
  if (answers.q1 === 'no_system') return 'Score override: digitise first';
  if (answers.q2 === 'very_little') return 'Score override: collect data first';
  if (answers.q1 === 'routine' && answers.q3 === 'straightforward') return 'Score override: simpler tool';
  return 'None';
}

// Fit bands
function getFitBand(score, override) {
  if (override !== 'None') return override;
  if (score >= 70) return 'Strong fit';
  if (score >= 45) return 'Promising, with groundwork';
  return 'Might suit a different solution';
}

// Impact bands
function getImpactBand(impactScore) {
  if (impactScore >= 7) return 'High impact';
  if (impactScore >= 4) return 'Moderate impact';
  return 'Lower impact';
}
```

### 2.4 Duplicate Detection
- [ ] Check if sessionId already exists in briefs table
- [ ] Return `{ success: true, duplicate: true }` if found
- [ ] Prevent re-submission of same form session

### 2.5 Validation
- [ ] Validate all required fields
- [ ] Validate email format (submitter and secondary contact)
- [ ] Validate phone format
- [ ] Validate country is in allowed list
- [ ] Validate consent checkbox was checked
- [ ] Validate totalOpportunities matches opportunities array length

### 2.6 Active Cohort Resolution
- [ ] Find active cohort for the country
- [ ] Assign briefs to that cohort (or default active cohort)
- [ ] Set brief status to SUBMITTED

---

## Phase 3: Frontend — Public Onboarding Form

### 3.1 Route Setup (Public Page)
- [ ] Create `/onboard` route in `(public)` route group (no auth layout)
- [ ] Ensure route is NOT wrapped in auth provider/middleware
- [ ] Add to Next.js config if needed for static/ISR
- [ ] Test that page loads without login
- [ ] Generate sessionId (UUID) on page load
- [ ] Persist form state to localStorage keyed by sessionId

### 3.2 Form State Management
```typescript
interface OnboardingState {
  sessionId: string;
  currentScreen: 's0' | 's1' | 's2' | 's3' | 's4' | 's5';
  organization: OrganizationData;
  totalOpportunities: number;
  currentOpportunityIndex: number;
  opportunities: OpportunityData[];
  answers: Record<string, string>;  // Current opportunity's Q1-Q8 answers
}
```

### 3.3 Progress Bar Component
- [ ] Fixed position at top
- [ ] Red fill color (#F90036)
- [ ] Updates based on screen progression

### 3.4 Screen 0: Welcome
- [ ] ATF AI Challenge eyebrow label
- [ ] "AI Opportunity Brief" heading
- [ ] Intro paragraph
- [ ] YouTube embed (video ID: Zad2WCdv9WA)
- [ ] "Get started →" button

### 3.5 Screen 1: Organization Details
- [ ] Section label "YOUR ORGANISATION"
- [ ] Error banner (hidden by default)
- [ ] Organization name input *
- [ ] Sector dropdown with options:
  - Healthcare, Agriculture, Finance, Local/Municipal Government, Education, Legal services, Retail/SME, Logistics, Manufacturing, Other
- [ ] Conditional "Please specify your sector" field when Other selected
- [ ] Country dropdown (Ghana, Nigeria, Kenya, South Africa)
- [ ] City/town input *
- [ ] Divider
- [ ] Your name input * (with placeholder hint)
- [ ] Your designation input *
- [ ] Department input (optional)
- [ ] Email input *
- [ ] Phone input * with dynamic placeholder based on country:
  - Ghana: +233 XX XXX XXXX
  - Nigeria: +234 XXX XXX XXXX
  - Kenya: +254 7XX XXX XXX
  - South Africa: +27 XX XXX XXXX
- [ ] Phone hint text
- [ ] Divider
- [ ] Consent paragraph
- [ ] Consent checkbox with label *
- [ ] Back / Next buttons

### 3.6 Screen 2: How Many Opportunities
- [ ] Section label "BEFORE YOU START"
- [ ] Heading and instruction text
- [ ] Three large numbered buttons (1, 2, 3)
- [ ] Selected state styling (red background)
- [ ] Back / Next buttons

### 3.7 Screen 3: Opportunity Details
- [ ] Opportunity progress bar (dots)
- [ ] "Opportunity X of Y" label
- [ ] Instruction box with important note
- [ ] Section label "OPPORTUNITY X"
- [ ] Error banner

**The Opportunity fields:**
- [ ] Title input *
- [ ] Description textarea * with helper text

**Impact Goal section:**
- [ ] "What changes" input * with "If this is solved, ___" prompt
- [ ] "How many people" input *

**Data and Access section:**
- [ ] Data description textarea *
- [ ] Data sharing radio group (4 options as styled cards):
  - Yes, we can share freely
  - Yes, with some conditions or restrictions
  - Partially: some can be shared, not all
  - No, these are confidential or restricted

**Named Contact section:**
- [ ] Instruction paragraph
- [ ] Contact name input *
- [ ] Contact role input *
- [ ] Contact email input *
- [ ] Contact phone input *

**Suitability Check section:**
- [ ] Section label and intro text
- [ ] Q1: Task nature (5 radio card options)
- [ ] Q2: Data availability (3 radio card options)
- [ ] Q3: Training complexity (3 radio card options)
- [ ] Q4: Error tolerance (2 radio card options)
- [ ] Q5: Impact clarity (2 radio card options)
- [ ] Q6: Frequency (2 radio card options)

**Impact section (conditional):**
- [ ] Show after Q6 is answered
- [ ] Smooth scroll to section
- [ ] Q7: Depth of change (3 radio card options)
- [ ] Q8: Breadth of impact (3 radio card options)

**Verdict Thermometer (conditional):**
- [ ] Show after Q8 is answered
- [ ] Calculate fit score (0-100)
- [ ] Display score with "/100"
- [ ] Gradient bar (grey → pink → red)
- [ ] Positioned marker dot
- [ ] "Early stage" / "Strong AI fit" labels
- [ ] Neutral message box

**Navigation:**
- [ ] Back button
- [ ] "Next →" button (if not last opportunity)
- [ ] "Submit all briefs →" button (if last opportunity)

### 3.8 Screen 4: Transition
- [ ] Checkmark icon
- [ ] "Great — your [ordinal] brief is recorded" heading
- [ ] "Let's move on to the [ordinal] one" text
- [ ] "Next opportunity →" button

### 3.9 Screen 5: Summary
- [ ] Success emoji
- [ ] "Thank you for your submission!" heading
- [ ] Dynamic count message
- [ ] List of submitted briefs with titles
- [ ] "Received — under review" status
- [ ] Note about country lead review

### 3.10 Styling
- [ ] Match exact color palette:
  - Red: #F90036
  - Navy: #1B2A4A
  - Teal: #17A589
  - Amber: #E8913A
  - Off white: #F7F8FA
  - Line: #E4E8EE
  - Slate: #5B6B7B
  - Ink: #1C2833
- [ ] Radio card component with selection state
- [ ] Input focus states (red border)
- [ ] Error state styling
- [ ] Mobile responsive (max-width: 480px breakpoint)

### 3.11 Form Submission
- [ ] Collect all data into payload
- [ ] Show loading spinner on submit button
- [ ] Disable button during submission
- [ ] Call POST `/public/organization-briefs`
- [ ] Handle success → navigate to summary
- [ ] Handle duplicate → show summary (already submitted)
- [ ] Handle error → show alert, re-enable button

---

## Phase 4: Admin Features

### 4.1 Public Submissions Queue
- [ ] GET `/admin/public-submissions` — List organizations submitted via public form
- [ ] Filter by country (Ghana, Nigeria, Kenya, South Africa)
- [ ] Filter by date range
- [ ] Filter by fit band
- [ ] Show fit score and band for each brief
- [ ] Show impact score and band
- [ ] Bulk approve/reject actions

### 4.2 Country Lead Assignment
- [ ] Route submissions to country leads based on organization country
- [ ] Country lead can filter to see only their country's submissions
- [ ] PATCH `/admin/briefs/:id/notes` — Update country lead notes
- [ ] Notes field visible in brief detail view

### 4.3 Score Override Management
- [ ] Display score overrides prominently in UI
- [ ] Visual indicator for overridden scores
- [ ] Allow manual score adjustment with reason
- [ ] Audit log for score changes

### 4.4 Brief Review Actions
- [ ] Approve brief (sets status, assigns to review queue)
- [ ] Reject brief with reason
- [ ] Request revision
- [ ] Assign to vertical

### 4.5 Export to CSV
- [ ] Export matching original Google Sheets format
- [ ] Include all columns from HEADERS constant
- [ ] Group by country (like original sheet tabs)
- [ ] Include scoring fields and override reasons

---

## Phase 5: Email Notifications

### 5.1 Submission Confirmation
- [ ] Send confirmation email to submitter
- [ ] Include organization name
- [ ] List all submitted opportunity titles
- [ ] Include session reference (sessionId)
- [ ] Note about country lead review timeline

### 5.2 Admin Notification
- [ ] Notify relevant country lead of new submission
- [ ] Include organization name and country
- [ ] Include number of opportunities
- [ ] Include fit scores summary
- [ ] Link to admin review page

### 5.3 Daily Digest (Optional)
- [ ] Aggregate new submissions by country
- [ ] Send to country leads
- [ ] Include score distribution summary

---

## Question Text Reference

### Q1: Task Nature
| Key | Label |
|-----|-------|
| routine | Repeating the same routine steps again and again (entering data, issuing receipts, filling standard forms) |
| judgement | Weighing things up and making judgement calls from experience (deciding what is risky, what to prioritise, what is likely next) |
| sense_making | Working through lots of documents, images, messages or recordings to find or make sense of what matters |
| no_system | There is no real system yet, so it is mostly manual, on paper, or in people's heads |
| new_capability | Something we want to be able to do but cannot currently: a new capability, service, or insight we want to offer |

### Q2: Data Availability
| Key | Label |
|-----|-------|
| good_records | Good digital records built up over time (files, spreadsheets, photos or logs) |
| partial | A little, but on paper, scattered or patchy |
| very_little | Very little, we would mostly be starting fresh |

### Q3: Training Complexity
| Key | Label |
|-----|-------|
| straightforward | Straightforward: a clear step by step procedure and they would get it right by following it |
| mixed | Mixed: there is a procedure, but plenty of exceptions and "it depends" moments |
| hard | Hard: it takes experience and judgement, and even two seasoned people might not fully agree |

### Q4: Error Tolerance
| Key | Label |
|-----|-------|
| yes | Yes, that would still be a big help |
| no_exact | No, it has to be exactly right every time (money, legal or safety reasons) |

### Q5: Impact Clarity
| Key | Label |
|-----|-------|
| clear | A clear, noticeable difference, with specific people ready to use it |
| vague | Some benefit, but hard to pin down, or no clear owner yet |

### Q6: Frequency
| Key | Label |
|-----|-------|
| very_often | Very often: many times a day, or across large numbers of cases |
| now_and_then | Now and then: a handful of times |

### Q7: Depth of Change
| Key | Label |
|-----|-------|
| convenient | Convenient improvement: makes an existing process easier or more efficient |
| meaningful | Meaningful change: significantly reduces time, cost or errors, or removes real friction |
| transformative | Transformative: unlocks something we currently cannot do, or clears a critical bottleneck |

### Q8: Breadth of Impact
| Key | Label |
|-----|-------|
| local | A handful to hundreds: one team, office, site or community |
| thousands | Thousands: a district, a city, or a network of sites |
| national | Hundreds of thousands or more: a national hub, system or widely-used service |

---

## Data Access Options

| Option Text |
|-------------|
| Yes, we can share freely |
| Yes, with some conditions or restrictions |
| Partially: some can be shared, not all |
| No, these are confidential or restricted |

---

## Data Mapping Reference (Google Sheets → Database)

| Google Sheet Column | Database Field | Notes |
|---------------------|----------------|-------|
| Timestamp | `brief.createdAt` | Auto-generated |
| Session ID | `brief.sessionId` | UUID from frontend |
| Opportunity # | `brief.opportunityNumber` | 1-3 |
| Total briefs | Computed from session | Count briefs with same sessionId |
| Organisation name | `organization.name` | |
| Sector | `organization.sector` | |
| Sector (if Other) | `organization.sectorOther` | |
| Country | `organization.country` | |
| City or town | `organization.city` | |
| Submitter name | `organization.submitterName` | |
| Designation | `organization.submitterDesignation` | |
| Department | `organization.submitterDepartment` | Optional |
| Email | `organization.contactEmail` | |
| Phone | `organization.contactPhone` | |
| Opportunity title | `brief.title` | |
| The opportunity... | `brief.content` or `brief.description` | |
| If addressed... | `brief.whatChanges` | New field |
| Roughly how many | `brief.affectedCount` | New field |
| Records and data | `brief.dataDescription` | New field |
| Can data be shared | `brief.dataAccess` | New field |
| Contact person name | `brief.secondaryContact.name` | JSON field |
| Contact person role | `brief.secondaryContact.role` | JSON field |
| Contact person email | `brief.secondaryContact.email` | JSON field |
| Contact person phone | `brief.secondaryContact.phone` | JSON field |
| Q1-Q8 answers | `brief.scoringAnswers` | JSON with keys and text |
| AI-Challenge Fit Score | `brief.fitScore` | Calculated 0-100 |
| Fit band | `brief.fitBand` | Enum |
| Score override | `brief.scoreOverride` | String or null |
| Depth score (1-3) | `brief.depthScore` | From Q7 |
| Breadth score (1-3) | `brief.breadthScore` | From Q8 |
| Impact score | `brief.impactScore` | depth × breadth |
| Impact band | `brief.impactBand` | Enum |
| Country lead notes | `brief.countryLeadNotes` | Admin-editable |

---

## Technical Notes

1. **Session ID**: Generated with `crypto.randomUUID()` on form load
2. **Duplicate Prevention**: Server checks if sessionId exists before creating
3. **Country Routing**: Filter in admin UI by `organization.country`
4. **Vertical Assignment**: `brief.verticalId` initially null, assigned during review
5. **Cohort Assignment**: Auto-assign to active cohort for country, or default active
6. **Status**: Briefs created with status `SUBMITTED`
7. **Organization Status**: Created with status `PENDING` for admin approval
8. **Consent**: Store `consentGiven: true` and `consentTimestamp`

---

## Estimated Effort

| Phase | Description | Tasks | Estimate |
|-------|-------------|-------|----------|
| Phase 1 | Database Schema | ~15 fields | 2-3 hours |
| Phase 2 | API Endpoints | Submission + scoring | 4-5 hours |
| Phase 3 | Frontend Form | 5 screens, validation, state | 12-16 hours |
| Phase 4 | Admin Features | Queue, export, notes | 4-6 hours |
| Phase 5 | Email | Confirmation + notifications | 2-3 hours |
| **Total** | | | **24-33 hours** |

---

## Files to Create/Modify

### Backend (apps/api)
- `src/database/entities/brief.entity.ts` — Add new fields
- `src/database/entities/organization.entity.ts` — Add new fields
- `src/database/migrations/XXXXXX-add-public-submission-fields.ts`
- `src/modules/briefs/brief-scoring.service.ts` — New service
- `src/modules/public/public.module.ts` — New module
- `src/modules/public/public.controller.ts` — POST endpoint
- `src/modules/public/public.service.ts` — Business logic
- `src/modules/public/dto/public-submission.dto.ts` — Request/response DTOs

### Frontend (apps/web)
- `src/app/(public)/onboard/page.tsx` — Main form page
- `src/components/onboarding/` — Form components
  - `OnboardingWizard.tsx`
  - `WelcomeScreen.tsx`
  - `OrganizationForm.tsx`
  - `OpportunityCountSelector.tsx`
  - `OpportunityForm.tsx`
  - `TransitionScreen.tsx`
  - `SummaryScreen.tsx`
  - `RadioCardGroup.tsx`
  - `VerdictThermometer.tsx`
  - `ProgressBar.tsx`
- `src/lib/api/public.ts` — API client for public endpoints
- `src/lib/scoring.ts` — Frontend scoring calculations (for thermometer)

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO public;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: activity_logs_activity_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_logs_activity_type_enum AS ENUM (
    'login',
    'logout',
    'token_refresh',
    'page_view',
    'dashboard_view',
    'api_request',
    'submission_create',
    'submission_update',
    'team_create',
    'team_update',
    'brief_view',
    'evaluation_create',
    'mentor_session',
    'forum_post',
    'chat_message'
);


--
-- Name: activity_logs_portal_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_logs_portal_enum AS ENUM (
    'staff',
    'participant',
    'organization',
    'mentor',
    'public'
);


--
-- Name: announcements_audience_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.announcements_audience_enum AS ENUM (
    'all',
    'vertical',
    'team',
    'organization',
    'mentor'
);


--
-- Name: announcements_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.announcements_status_enum AS ENUM (
    'draft',
    'scheduled',
    'published',
    'archived'
);


--
-- Name: audit_logs_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_logs_action_enum AS ENUM (
    'create',
    'update',
    'delete',
    'login',
    'logout',
    'password_change',
    'status_change',
    'assignment',
    'bulk_import',
    'bulk_action',
    'approval',
    'rejection'
);


--
-- Name: brief_fit_band_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brief_fit_band_enum AS ENUM (
    'strong_fit',
    'promising',
    'different_solution',
    'override_digitise',
    'override_collect_data',
    'override_simpler_tool'
);


--
-- Name: brief_impact_band_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brief_impact_band_enum AS ENUM (
    'high_impact',
    'moderate_impact',
    'lower_impact'
);


--
-- Name: brief_revision_actor_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brief_revision_actor_type_enum AS ENUM (
    'organization',
    'staff',
    'system'
);


--
-- Name: brief_revisions_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brief_revisions_action_enum AS ENUM (
    'submitted',
    'approved',
    'rejected',
    'revision_requested',
    'updated',
    'restored'
);


--
-- Name: brief_revisions_actor_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.brief_revisions_actor_type_enum AS ENUM (
    'organization',
    'staff',
    'system'
);


--
-- Name: briefs_fit_band_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.briefs_fit_band_enum AS ENUM (
    'strong_fit',
    'promising',
    'different_solution',
    'override_digitise',
    'override_collect_data',
    'override_simpler_tool'
);


--
-- Name: briefs_impact_band_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.briefs_impact_band_enum AS ENUM (
    'high_impact',
    'moderate_impact',
    'lower_impact'
);


--
-- Name: briefs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.briefs_status_enum AS ENUM (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'revision_requested'
);


--
-- Name: certificates_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.certificates_status_enum AS ENUM (
    'pending',
    'generated',
    'failed'
);


--
-- Name: certificates_tier_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.certificates_tier_enum AS ENUM (
    'participation',
    'completion',
    'excellence',
    'winner'
);


--
-- Name: channel_members_member_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_members_member_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff',
    'organization',
    'system'
);


--
-- Name: chat_channels_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_channels_type_enum AS ENUM (
    'team',
    'mentor_team',
    'staff',
    'announcement',
    'direct'
);


--
-- Name: chat_messages_message_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_messages_message_type_enum AS ENUM (
    'text',
    'image',
    'file',
    'system'
);


--
-- Name: chat_messages_sender_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chat_messages_sender_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff',
    'organization',
    'system'
);


--
-- Name: cohorts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cohorts_status_enum AS ENUM (
    'draft',
    'active',
    'evaluation',
    'completed',
    'archived'
);


--
-- Name: evaluation_jobs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.evaluation_jobs_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: forum_replies_author_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forum_replies_author_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff'
);


--
-- Name: forum_thread_views_viewer_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forum_thread_views_viewer_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff'
);


--
-- Name: forum_threads_author_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forum_threads_author_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff'
);


--
-- Name: journal_entries_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entries_status_enum AS ENUM (
    'draft',
    'published'
);


--
-- Name: mentor_claims_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mentor_claims_status_enum AS ENUM (
    'active',
    'expired',
    'completed',
    'released',
    'swapped'
);


--
-- Name: mentor_payment_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mentor_payment_status_enum AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: mentor_payments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mentor_payments_status_enum AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: mentors_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mentors_status_enum AS ENUM (
    'imported',
    'active',
    'inactive'
);


--
-- Name: message_reactions_reactor_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_reactions_reactor_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff',
    'organization',
    'system'
);


--
-- Name: notification_preferences_user_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_preferences_user_type_enum AS ENUM (
    'user',
    'participant',
    'mentor',
    'organization'
);


--
-- Name: notifications_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notifications_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: notifications_recipient_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notifications_recipient_type_enum AS ENUM (
    'user',
    'participant',
    'mentor',
    'organization'
);


--
-- Name: notifications_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notifications_type_enum AS ENUM (
    'team_invitation',
    'team_invitation_accepted',
    'team_invitation_declined',
    'team_member_joined',
    'team_member_left',
    'team_join_request',
    'team_join_confirmed',
    'team_join_declined',
    'team_member_removal_requested',
    'team_member_removal_approved',
    'team_member_removal_rejected',
    'mentor_assigned',
    'mentor_session_scheduled',
    'mentor_session_reminder',
    'mentor_session_requested',
    'mentor_session_confirmed',
    'mentor_session_declined',
    'brief_status_changed',
    'brief_submitted',
    'brief_selected',
    'submission_received',
    'submission_deadline',
    'submission_needs_approval',
    'submission_approved',
    'submission_rejected',
    'evaluation_complete',
    'chat_message',
    'chat_mention',
    'forum_reply',
    'forum_mention',
    'forum_thread_reply',
    'announcement',
    'deadline_reminder',
    'system_alert'
);


--
-- Name: organization_users_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.organization_users_role_enum AS ENUM (
    'owner',
    'admin',
    'member'
);


--
-- Name: organizations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.organizations_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: participants_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.participants_status_enum AS ENUM (
    'imported',
    'active',
    'onboarding',
    'ready',
    'assigned',
    'inactive'
);


--
-- Name: peer_review_assignments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.peer_review_assignments_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped'
);


--
-- Name: push_tokens_user_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.push_tokens_user_type_enum AS ENUM (
    'user',
    'participant',
    'mentor',
    'organization'
);


--
-- Name: removal_request_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.removal_request_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: resources_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resources_type_enum AS ENUM (
    'document',
    'video',
    'link',
    'template'
);


--
-- Name: resources_visibility_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resources_visibility_enum AS ENUM (
    'all',
    'vertical',
    'staff'
);


--
-- Name: scheduled_sessions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scheduled_sessions_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'declined',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
);


--
-- Name: stages_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stages_type_enum AS ENUM (
    'document',
    'video',
    'url',
    'text',
    'mixed'
);


--
-- Name: submissions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submissions_status_enum AS ENUM (
    'draft',
    'submitted',
    'late',
    'pending_approval',
    'approved',
    'rejected',
    'evaluated'
);


--
-- Name: team_invitations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_invitations_status_enum AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired',
    'cancelled'
);


--
-- Name: team_member_removal_requests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_member_removal_requests_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: team_member_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_member_status_enum AS ENUM (
    'pending',
    'confirmed'
);


--
-- Name: team_members_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_members_role_enum AS ENUM (
    'lead',
    'co_lead',
    'member'
);


--
-- Name: team_members_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.team_members_status_enum AS ENUM (
    'pending',
    'confirmed'
);


--
-- Name: teams_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.teams_status_enum AS ENUM (
    'forming',
    'active',
    'submitted',
    'evaluated',
    'disqualified'
);


--
-- Name: typing_indicators_user_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.typing_indicators_user_type_enum AS ENUM (
    'participant',
    'mentor',
    'staff',
    'organization',
    'system'
);


--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.users_role_enum AS ENUM (
    'super_admin',
    'program_manager',
    'evaluator',
    'viewer',
    'organization',
    'participant',
    'mentor'
);


--
-- Name: verification_codes_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_codes_type_enum AS ENUM (
    'magic_link',
    'password_reset',
    'email_verification'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid,
    participant_id character varying,
    cohort_id uuid,
    activity_type public.activity_logs_activity_type_enum NOT NULL,
    portal public.activity_logs_portal_enum DEFAULT 'public'::public.activity_logs_portal_enum NOT NULL,
    path character varying,
    method character varying,
    status_code integer,
    response_time_ms integer,
    ip_address character varying,
    user_agent text,
    metadata jsonb,
    hour_of_day smallint,
    day_of_week smallint
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    audience public.announcements_audience_enum DEFAULT 'all'::public.announcements_audience_enum NOT NULL,
    "audienceValue" jsonb,
    status public.announcements_status_enum DEFAULT 'draft'::public.announcements_status_enum NOT NULL,
    "scheduledAt" timestamp without time zone,
    "publishedAt" timestamp without time zone,
    "isPinned" boolean DEFAULT false NOT NULL,
    "readCount" integer DEFAULT 0 NOT NULL,
    "cohortId" uuid NOT NULL,
    "createdById" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    actor_id uuid,
    actor_email character varying,
    action public.audit_logs_action_enum NOT NULL,
    entity_type character varying NOT NULL,
    entity_id character varying,
    entity_name character varying,
    before jsonb,
    after jsonb,
    changes jsonb,
    description character varying,
    ip_address character varying,
    user_agent character varying,
    metadata jsonb
);


--
-- Name: brief_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brief_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    brief_id uuid NOT NULL,
    action public.brief_revisions_action_enum NOT NULL,
    actor_id character varying,
    actor_name character varying,
    comment text,
    "previousData" jsonb,
    "newData" jsonb,
    version integer DEFAULT 1 NOT NULL,
    actor_type public.brief_revisions_actor_type_enum
);


--
-- Name: briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.briefs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    title character varying NOT NULL,
    description text NOT NULL,
    problem_statement text NOT NULL,
    expected_outcomes text NOT NULL,
    vertical_id uuid,
    status public.briefs_status_enum DEFAULT 'draft'::public.briefs_status_enum NOT NULL,
    cohort_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    teams_count integer DEFAULT 0 NOT NULL,
    max_teams integer DEFAULT 25 NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    resources jsonb,
    video_url character varying,
    image_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    review_feedback text,
    reviewed_by character varying,
    reviewed_at timestamp without time zone,
    submitted_at timestamp without time zone,
    approved_at timestamp without time zone,
    revision_count integer DEFAULT 0 NOT NULL,
    video_thumbnail_url character varying,
    session_id character varying,
    opportunity_number integer,
    what_changes text,
    affected_count character varying,
    data_description text,
    data_access character varying,
    secondary_contact jsonb,
    scoring_answers jsonb,
    fit_score integer,
    fit_band public.briefs_fit_band_enum,
    score_override character varying,
    depth_score integer,
    breadth_score integer,
    impact_score integer,
    impact_band public.briefs_impact_band_enum,
    country_lead_notes text,
    current_version integer DEFAULT 1 NOT NULL,
    priority_score integer DEFAULT 0
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    certificate_id character varying NOT NULL,
    cohort_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    team_id uuid,
    tier public.certificates_tier_enum NOT NULL,
    status public.certificates_status_enum DEFAULT 'pending'::public.certificates_status_enum NOT NULL,
    participant_name character varying NOT NULL,
    team_name character varying,
    cohort_name character varying NOT NULL,
    vertical_name character varying,
    final_score numeric(5,2),
    rank integer,
    pdf_url character varying,
    qr_code_data character varying,
    generated_at timestamp without time zone,
    generated_by character varying,
    error_message character varying,
    verification_url character varying,
    download_count integer DEFAULT 0 NOT NULL,
    last_downloaded_at timestamp without time zone
);


--
-- Name: channel_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    channel_id uuid NOT NULL,
    member_id character varying NOT NULL,
    member_type public.channel_members_member_type_enum NOT NULL,
    member_name character varying NOT NULL,
    member_avatar_url character varying,
    last_read_at timestamp without time zone,
    last_read_message_id character varying,
    is_admin boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    muted_until timestamp without time zone,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    left_at timestamp without time zone
);


--
-- Name: chat_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_channels (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    description text,
    type public.chat_channels_type_enum NOT NULL,
    cohort_id uuid,
    team_id uuid,
    is_private boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    metadata jsonb
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    channel_id uuid NOT NULL,
    sender_id character varying NOT NULL,
    sender_type public.chat_messages_sender_type_enum NOT NULL,
    sender_name character varying NOT NULL,
    sender_avatar_url character varying,
    content text NOT NULL,
    message_type public.chat_messages_message_type_enum DEFAULT 'text'::public.chat_messages_message_type_enum NOT NULL,
    attachment_url character varying,
    attachment_name character varying,
    attachment_size integer,
    attachment_mime_type character varying,
    reply_to_id uuid,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp without time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    metadata jsonb
);


--
-- Name: cohorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohorts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    description text,
    status public.cohorts_status_enum DEFAULT 'draft'::public.cohorts_status_enum NOT NULL,
    team_size_min integer DEFAULT 3 NOT NULL,
    team_size_max integer DEFAULT 5 NOT NULL,
    deadlines jsonb DEFAULT '{}'::jsonb NOT NULL,
    rubric jsonb,
    countries jsonb DEFAULT '[]'::jsonb NOT NULL,
    verticals jsonb DEFAULT '[]'::jsonb NOT NULL,
    brief_cap integer DEFAULT 50 NOT NULL,
    max_teams_per_brief integer DEFAULT 25 NOT NULL,
    leaderboard_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    stage_names jsonb DEFAULT '{}'::jsonb NOT NULL,
    session_rate numeric(10,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: evaluation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    cohort_id uuid NOT NULL,
    status public.evaluation_jobs_status_enum DEFAULT 'pending'::public.evaluation_jobs_status_enum NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    current_step character varying,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    error text,
    error_stack text,
    bull_job_id character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    processing_time_ms integer
);


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    cohort_id uuid NOT NULL,
    ai_scores jsonb,
    ai_overall_score numeric(5,2),
    ai_feedback text,
    ai_strengths jsonb,
    ai_improvements jsonb,
    human_scores jsonb,
    human_overall_score numeric(5,2),
    human_feedback text,
    final_score numeric(5,2),
    ai_weight numeric(3,2) DEFAULT 0.4 NOT NULL,
    metrics jsonb,
    ai_evaluated_at timestamp without time zone,
    human_evaluated_at timestamp without time zone,
    human_evaluator_id character varying,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp without time zone
);


--
-- Name: forum_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    description text,
    cohort_id uuid NOT NULL,
    vertical_id character varying,
    icon_name character varying,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    staff_only boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL
);


--
-- Name: forum_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_replies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    thread_id uuid NOT NULL,
    content text NOT NULL,
    author_id character varying NOT NULL,
    author_type public.forum_replies_author_type_enum NOT NULL,
    author_name character varying NOT NULL,
    author_avatar_url character varying,
    parent_reply_id uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp without time zone,
    is_solution boolean DEFAULT false NOT NULL,
    marked_solution_at timestamp without time zone,
    marked_solution_by character varying
);


--
-- Name: forum_thread_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_thread_views (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    thread_id uuid NOT NULL,
    viewer_id character varying NOT NULL,
    viewer_type public.forum_thread_views_viewer_type_enum NOT NULL,
    last_viewed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: forum_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_threads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    category_id uuid NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    author_id character varying NOT NULL,
    author_type public.forum_threads_author_type_enum NOT NULL,
    author_name character varying NOT NULL,
    author_avatar_url character varying,
    is_pinned boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp without time zone,
    reply_count integer DEFAULT 0 NOT NULL,
    last_reply_at timestamp without time zone,
    last_reply_author_name character varying,
    view_count integer DEFAULT 0 NOT NULL
);


--
-- Name: github_analyses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_analyses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    submission_id uuid,
    github_url character varying NOT NULL,
    repo_full_name character varying NOT NULL,
    metrics jsonb NOT NULL,
    code_structure jsonb NOT NULL,
    commit_patterns jsonb NOT NULL,
    readme text,
    summary jsonb,
    analyzed_at timestamp without time zone NOT NULL,
    analysis_version integer DEFAULT 1 NOT NULL,
    error_message character varying
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    cohort_id uuid NOT NULL,
    author_id uuid NOT NULL,
    week_number integer NOT NULL,
    title text,
    content text NOT NULL,
    highlights jsonb,
    challenges jsonb,
    next_week_goals jsonb,
    status public.journal_entries_status_enum DEFAULT 'published'::public.journal_entries_status_enum NOT NULL,
    editable_until timestamp without time zone NOT NULL,
    last_edited_at timestamp without time zone,
    last_edited_by character varying,
    word_count integer DEFAULT 0 NOT NULL
);


--
-- Name: mentor_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    team_id uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    assigned_by character varying,
    is_active boolean DEFAULT true NOT NULL,
    unassigned_at timestamp without time zone,
    unassign_reason character varying,
    notes text
);


--
-- Name: mentor_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_availability (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 45 NOT NULL,
    buffer_minutes integer DEFAULT 15 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    timezone character varying DEFAULT 'Africa/Nairobi'::character varying NOT NULL
);


--
-- Name: mentor_availability_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_availability_exceptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    date date NOT NULL,
    is_unavailable boolean DEFAULT false NOT NULL,
    custom_slots jsonb,
    reason text
);


--
-- Name: mentor_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_claims (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    team_id uuid NOT NULL,
    claimed_at timestamp without time zone DEFAULT now() NOT NULL,
    claimed_by character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    status public.mentor_claims_status_enum DEFAULT 'active'::public.mentor_claims_status_enum NOT NULL,
    session_count integer DEFAULT 0 NOT NULL,
    swap_used boolean DEFAULT false NOT NULL,
    proposal_snapshot jsonb,
    released_at timestamp without time zone,
    release_reason character varying,
    previous_claim_id character varying
);


--
-- Name: mentor_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    status public.mentor_payments_status_enum DEFAULT 'pending'::public.mentor_payments_status_enum NOT NULL,
    sessions_count integer DEFAULT 0 NOT NULL,
    session_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    period_start date,
    period_end date,
    paid_at timestamp without time zone,
    paid_by character varying,
    payment_reference character varying,
    payment_method character varying,
    notes text
);


--
-- Name: mentor_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentor_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mentor_id uuid NOT NULL,
    team_id uuid NOT NULL,
    session_date timestamp without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    notes text,
    topics_discussed jsonb DEFAULT '[]'::jsonb NOT NULL,
    action_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    team_progress_notes text,
    next_session_goals text,
    session_type character varying DEFAULT 'regular'::character varying NOT NULL
);


--
-- Name: mentors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    email character varying NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    phone character varying,
    company character varying,
    title character varying,
    bio text,
    profile_image_url character varying,
    expertise jsonb DEFAULT '[]'::jsonb NOT NULL,
    linkedin_url character varying,
    max_teams integer DEFAULT 3 NOT NULL,
    vertical_scope jsonb DEFAULT '[]'::jsonb NOT NULL,
    firebase_uid character varying,
    status public.mentors_status_enum DEFAULT 'active'::public.mentors_status_enum NOT NULL,
    cohort_id uuid NOT NULL,
    capabilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    google_calendar_id character varying,
    max_claims integer DEFAULT 3 NOT NULL,
    session_rate_override numeric(10,2)
);


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    message_id uuid NOT NULL,
    reactor_id character varying NOT NULL,
    reactor_type public.message_reactions_reactor_type_enum NOT NULL,
    emoji character varying NOT NULL
);


Schema: public; Owner: -
--




Schema: public; Owner: -
--




Schema: public; Owner: -
--




--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id character varying NOT NULL,
    user_type public.notification_preferences_user_type_enum NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    type_settings jsonb,
    quiet_hours_start character varying,
    quiet_hours_end character varying,
    timezone character varying
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    recipient_id character varying NOT NULL,
    recipient_type public.notifications_recipient_type_enum NOT NULL,
    type public.notifications_type_enum NOT NULL,
    title character varying NOT NULL,
    body text NOT NULL,
    summary text,
    data jsonb,
    action_url character varying,
    icon_name character varying,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp without time zone,
    priority public.notifications_priority_enum DEFAULT 'normal'::public.notifications_priority_enum NOT NULL,
    email_sent boolean DEFAULT false NOT NULL,
    email_sent_at timestamp without time zone,
    push_sent boolean DEFAULT false NOT NULL,
    push_sent_at timestamp without time zone,
    expires_at timestamp without time zone,
    group_key character varying
);


--
-- Name: organization_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    organization_id uuid NOT NULL,
    user_id character varying NOT NULL,
    role public.organization_users_role_enum DEFAULT 'member'::public.organization_users_role_enum NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    email character varying NOT NULL,
    website character varying,
    logo_url character varying,
    description text,
    industry character varying,
    country character varying,
    contact_person character varying,
    contact_phone character varying,
    status public.organizations_status_enum DEFAULT 'pending'::public.organizations_status_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    approved_at timestamp without time zone,
    approved_by character varying,
    rejection_reason text,
    cohort_id uuid,
    city character varying,
    sector character varying,
    sector_other character varying,
    submitter_name character varying,
    submitter_designation character varying,
    submitter_department character varying,
    public_submission boolean DEFAULT false NOT NULL,
    consent_given boolean DEFAULT false NOT NULL,
    consent_timestamp timestamp without time zone
);


--
-- Name: participant_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participant_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    participant_id uuid NOT NULL,
    vertical_id_1 uuid,
    vertical_id_2 uuid,
    brief_rankings jsonb DEFAULT '[]'::jsonb NOT NULL,
    cross_country_willing boolean DEFAULT true NOT NULL,
    preferred_role character varying,
    "availabilityNotes" text,
    preferences_updated_at timestamp without time zone
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    participant_id character varying NOT NULL,
    email character varying NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    country character varying NOT NULL,
    institution character varying,
    phone_number character varying,
    skills jsonb DEFAULT '[]'::jsonb NOT NULL,
    interests jsonb DEFAULT '[]'::jsonb NOT NULL,
    firebase_uid character varying,
    must_change_password boolean DEFAULT true NOT NULL,
    onboarding_complete boolean DEFAULT false NOT NULL,
    status public.participants_status_enum DEFAULT 'imported'::public.participants_status_enum NOT NULL,
    cohort_id uuid NOT NULL,
    password_hash character varying,
    profile_image_url character varying
);


--
-- Name: peer_review_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_review_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    cohort_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    reviewer_team_id uuid NOT NULL,
    reviewed_team_id uuid NOT NULL,
    status public.peer_review_assignments_status_enum DEFAULT 'pending'::public.peer_review_assignments_status_enum NOT NULL,
    due_date timestamp without time zone NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: peer_review_rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_review_rubrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    cohort_id uuid NOT NULL,
    stage_id uuid,
    name character varying NOT NULL,
    description text,
    criteria jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: peer_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.peer_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    assignment_id uuid NOT NULL,
    reviewer_participant_id uuid NOT NULL,
    scores jsonb NOT NULL,
    overall_score numeric(5,2) NOT NULL,
    overall_comment text,
    strengths jsonb,
    improvements jsonb,
    is_anonymous boolean DEFAULT true NOT NULL,
    submitted_at timestamp without time zone NOT NULL,
    time_spent_minutes integer,
    is_flagged boolean DEFAULT false NOT NULL,
    flag_reason character varying
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id character varying NOT NULL,
    user_type public.push_tokens_user_type_enum NOT NULL,
    token character varying NOT NULL,
    device_type character varying,
    device_name character varying,
    last_active_at timestamp without time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token character varying NOT NULL,
    "userId" uuid,
    "expiresAt" timestamp without time zone NOT NULL,
    "isRevoked" boolean DEFAULT false NOT NULL,
    "revokedAt" timestamp without time zone,
    "revokedReason" character varying,
    "userAgent" character varying,
    "ipAddress" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastUsedAt" timestamp without time zone,
    "participantId" uuid
);


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    cohort_id uuid,
    vertical_id uuid,
    title character varying NOT NULL,
    description text,
    type public.resources_type_enum NOT NULL,
    file_url character varying,
    external_url character varying,
    video_embed_url character varying,
    file_name character varying,
    file_size integer,
    file_type character varying,
    thumbnail_url character varying,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    visibility public.resources_visibility_enum DEFAULT 'all'::public.resources_visibility_enum NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    download_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    uploaded_by character varying NOT NULL
);


--
-- Name: scheduled_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    claim_id uuid NOT NULL,
    mentor_id uuid NOT NULL,
    team_id uuid NOT NULL,
    session_number integer NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer DEFAULT 45 NOT NULL,
    question text NOT NULL,
    status public.scheduled_sessions_status_enum DEFAULT 'scheduled'::public.scheduled_sessions_status_enum NOT NULL,
    google_event_id character varying,
    google_meet_link character varying,
    booked_by character varying NOT NULL,
    booked_at timestamp without time zone DEFAULT now() NOT NULL,
    confirmed_by_mentor boolean DEFAULT false NOT NULL,
    confirmed_at timestamp without time zone,
    completed_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancel_reason character varying,
    cancelled_by character varying,
    notes text,
    action_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    mentor_feedback text,
    team_feedback text,
    rating integer,
    declined_at timestamp without time zone,
    decline_reason character varying,
    google_calendar_link character varying
);


--
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    cohort_id uuid NOT NULL,
    number integer NOT NULL,
    name character varying NOT NULL,
    description text,
    instructions text,
    type public.stages_type_enum DEFAULT 'mixed'::public.stages_type_enum NOT NULL,
    start_date timestamp without time zone,
    deadline timestamp without time zone NOT NULL,
    requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    weight_percentage numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    allow_late_submissions boolean DEFAULT true NOT NULL,
    late_penalty_percentage numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    unlocks_mentor_claim boolean DEFAULT false NOT NULL,
    requires_manual_approval boolean DEFAULT false NOT NULL
);


--
-- Name: submission_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submission_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    submission_id uuid NOT NULL,
    version integer NOT NULL,
    content jsonb NOT NULL,
    file_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    github_url character varying,
    video_url character varying,
    saved_by character varying NOT NULL,
    saved_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    status public.submissions_status_enum DEFAULT 'draft'::public.submissions_status_enum NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    file_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    github_url character varying,
    video_url character varying,
    submitted_at timestamp without time zone,
    submitted_by character varying,
    is_late boolean DEFAULT false NOT NULL,
    late_minutes integer DEFAULT 0 NOT NULL,
    score numeric(5,2),
    evaluated_at timestamp without time zone,
    evaluated_by character varying,
    evaluation_notes text,
    feedback jsonb,
    version integer DEFAULT 1 NOT NULL,
    last_saved_at timestamp without time zone,
    approved_at timestamp without time zone,
    approved_by character varying,
    approval_notes text,
    rejected_at timestamp without time zone,
    rejected_by character varying,
    rejection_reason text
);


--
-- Name: team_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invitations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    status public.team_invitations_status_enum DEFAULT 'pending'::public.team_invitations_status_enum NOT NULL,
    message text,
    invited_at timestamp without time zone DEFAULT now() NOT NULL,
    responded_at timestamp without time zone,
    expires_at timestamp without time zone
);


--
-- Name: team_member_removal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_member_removal_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    member_id uuid,
    participant_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    status public.team_member_removal_requests_status_enum DEFAULT 'pending'::public.team_member_removal_requests_status_enum NOT NULL,
    reason text,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    resolved_by character varying,
    resolution_notes text
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    team_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    role public.team_members_role_enum DEFAULT 'member'::public.team_members_role_enum NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    status public.team_members_status_enum DEFAULT 'confirmed'::public.team_members_status_enum NOT NULL,
    confirmed_at timestamp without time zone,
    confirmed_by character varying
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    description text,
    status public.teams_status_enum DEFAULT 'forming'::public.teams_status_enum NOT NULL,
    cohort_id uuid NOT NULL,
    brief_id uuid,
    invite_code character varying NOT NULL,
    metadata jsonb,
    disqualification_reason character varying,
    disqualified_at timestamp without time zone,
    disqualified_by character varying,
    mentor_id uuid,
    github_repo_url character varying
);


--
-- Name: typing_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.typing_indicators (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    channel_id character varying NOT NULL,
    user_id character varying NOT NULL,
    user_type public.typing_indicators_user_type_enum NOT NULL,
    user_name character varying NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    email character varying NOT NULL,
    role public.users_role_enum NOT NULL,
    first_name character varying,
    last_name character varying,
    avatar_url character varying,
    firebase_uid character varying,
    password_hash character varying,
    must_change_password boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp without time zone,
    password_changed_at timestamp without time zone
);


--
-- Name: verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_codes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    email character varying NOT NULL,
    code character varying NOT NULL,
    type public.verification_codes_type_enum NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    portal character varying,
    user_id uuid,
    organization_id uuid
);


--
-- Name: verticals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verticals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    description text,
    brief_cap integer DEFAULT 10 NOT NULL,
    brief_count integer DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    cohort_id uuid NOT NULL
);


Schema: public; Owner: -
--




--
-- Name: github_analyses PK_109984e18d8aac9ec859856ff4c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_analyses
    ADD CONSTRAINT "PK_109984e18d8aac9ec859856ff4c" PRIMARY KEY (id);


--
-- Name: submissions PK_10b3be95b8b2fb1e482e07d706b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY (id);


--
-- Name: mentor_assignments PK_113538c846de699a5ddfa80e41c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_assignments
    ADD CONSTRAINT "PK_113538c846de699a5ddfa80e41c" PRIMARY KEY (id);


--
-- Name: submission_history PK_117f7e255b4beed18f4ee98d369; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_history
    ADD CONSTRAINT "PK_117f7e255b4beed18f4ee98d369" PRIMARY KEY (id);


--
-- Name: stages PK_16efa0f8f5386328944769b9e6d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT "PK_16efa0f8f5386328944769b9e6d" PRIMARY KEY (id);


--
-- Name: verification_codes PK_18741b6b8bf1680dbf5057421d7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT "PK_18741b6b8bf1680dbf5057421d7" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: participants PK_1cda06c31eec1c95b3365a0283f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT "PK_1cda06c31eec1c95b3365a0283f" PRIMARY KEY (id);


--
-- Name: briefs PK_1e3944bfaf5baf0f14b0bc892b9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.briefs
    ADD CONSTRAINT "PK_1e3944bfaf5baf0f14b0bc892b9" PRIMARY KEY (id);


--
-- Name: peer_reviews PK_2532078fca474d3c97e56a5bd19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_reviews
    ADD CONSTRAINT "PK_2532078fca474d3c97e56a5bd19" PRIMARY KEY (id);


--
-- Name: evaluation_jobs PK_25d723fd13ed62b277c1166f106; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_jobs
    ADD CONSTRAINT "PK_25d723fd13ed62b277c1166f106" PRIMARY KEY (id);


--
-- Name: mentor_claims PK_2d414d6ae5d315daa028625c08b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_claims
    ADD CONSTRAINT "PK_2d414d6ae5d315daa028625c08b" PRIMARY KEY (id);


--
-- Name: push_tokens PK_32734e87f299c29ca3878861f4f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT "PK_32734e87f299c29ca3878861f4f" PRIMARY KEY (id);


--
-- Name: forum_threads PK_38ce39ab347624dee46e0d11e95; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT "PK_38ce39ab347624dee46e0d11e95" PRIMARY KEY (id);


--
-- Name: scheduled_sessions PK_3fc6682a329d8e9811620bd3090; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT "PK_3fc6682a329d8e9811620bd3090" PRIMARY KEY (id);


--
-- Name: chat_messages PK_40c55ee0e571e268b0d3cd37d10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY (id);


--
-- Name: verticals PK_4e8ec222adec40145daed4cd196; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verticals
    ADD CONSTRAINT "PK_4e8ec222adec40145daed4cd196" PRIMARY KEY (id);


--
-- Name: forum_categories PK_502afa07fc57ce4b302dc00217e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT "PK_502afa07fc57ce4b302dc00217e" PRIMARY KEY (id);


--
-- Name: forum_replies PK_5ae886513e9828a592aefa1b7b9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT "PK_5ae886513e9828a592aefa1b7b9" PRIMARY KEY (id);


--
-- Name: participant_preferences PK_5e7537cb6d6657d8fed636785ae; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_preferences
    ADD CONSTRAINT "PK_5e7537cb6d6657d8fed636785ae" PRIMARY KEY (id);


--
-- Name: resources PK_632484ab9dff41bba94f9b7c85e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT "PK_632484ab9dff41bba94f9b7c85e" PRIMARY KEY (id);


--
-- Name: message_reactions PK_654a9f0059ff93a8f156be66a5b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT "PK_654a9f0059ff93a8f156be66a5b" PRIMARY KEY (id);


--
-- Name: mentors PK_67a614446eab992e4d0580afebf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT "PK_67a614446eab992e4d0580afebf" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: peer_review_rubrics PK_769d496db44addefa056966dfde; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_rubrics
    ADD CONSTRAINT "PK_769d496db44addefa056966dfde" PRIMARY KEY (id);


--
-- Name: refresh_tokens PK_7d8bee0204106019488c4c50ffa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY (id);


--
-- Name: teams PK_7e5523774a38b08a6236d322403; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY (id);


--
-- Name: brief_revisions PK_85bb3f3c2f9edee24c4cf86ba22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brief_revisions
    ADD CONSTRAINT "PK_85bb3f3c2f9edee24c4cf86ba22" PRIMARY KEY (id);


--
-- Name: mentor_payments PK_8b23c77599687ccbe931941826a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_payments
    ADD CONSTRAINT "PK_8b23c77599687ccbe931941826a" PRIMARY KEY (id);


Type: CONSTRAINT; Schema: public; Owner: -
--




--
-- Name: channel_members PK_95976b619edca48aed364c70c36; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT "PK_95976b619edca48aed364c70c36" PRIMARY KEY (id);


--
-- Name: forum_thread_views PK_a36081d48e7f21bbe7c50c38e54; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_thread_views
    ADD CONSTRAINT "PK_a36081d48e7f21bbe7c50c38e54" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: journal_entries PK_a70368e64230434457c8d007ab3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "PK_a70368e64230434457c8d007ab3" PRIMARY KEY (id);


--
-- Name: organization_users PK_af79a22d50256af35812ba60a87; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_users
    ADD CONSTRAINT "PK_af79a22d50256af35812ba60a87" PRIMARY KEY (id);


--
-- Name: announcements PK_b3ad760876ff2e19d58e05dc8b0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT "PK_b3ad760876ff2e19d58e05dc8b0" PRIMARY KEY (id);


--
-- Name: mentor_availability PK_bbe3ae22ff86f32256b3de2bd4e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_availability
    ADD CONSTRAINT "PK_bbe3ae22ff86f32256b3de2bd4e" PRIMARY KEY (id);


--
-- Name: mentor_sessions PK_c03ac178b7ea07c64f0125d5cb2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_sessions
    ADD CONSTRAINT "PK_c03ac178b7ea07c64f0125d5cb2" PRIMARY KEY (id);


--
-- Name: team_invitations PK_c14b443d431077f89344a3fd262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "PK_c14b443d431077f89344a3fd262" PRIMARY KEY (id);


--
-- Name: typing_indicators PK_c7268631893a80a80154c33f4dc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.typing_indicators
    ADD CONSTRAINT "PK_c7268631893a80a80154c33f4dc" PRIMARY KEY (id);


--
-- Name: team_members PK_ca3eae89dcf20c9fd95bf7460aa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY (id);


--
-- Name: team_member_removal_requests PK_e3b35a44a5363a4414acea3f884; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_removal_requests
    ADD CONSTRAINT "PK_e3b35a44a5363a4414acea3f884" PRIMARY KEY (id);


--
-- Name: certificates PK_e4c7e31e2144300bea7d89eb165; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "PK_e4c7e31e2144300bea7d89eb165" PRIMARY KEY (id);


--
-- Name: notification_preferences PK_e94e2b543f2f218ee68e4f4fad2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY (id);


--
-- Name: chat_channels PK_efecd102855fb96e1428306ec6f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT "PK_efecd102855fb96e1428306ec6f" PRIMARY KEY (id);


--
-- Name: peer_review_assignments PK_f2371aff05a6f11e9c1657c9bf0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "PK_f2371aff05a6f11e9c1657c9bf0" PRIMARY KEY (id);


--
-- Name: activity_logs PK_f25287b6140c5ba18d38776a796; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY (id);


--
-- Name: evaluations PK_f683b433eba0e6dae7e19b29e29; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY (id);


--
-- Name: mentor_availability_exceptions PK_fbdcccc322d5dfa745e776eeb16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_availability_exceptions
    ADD CONSTRAINT "PK_fbdcccc322d5dfa745e776eeb16" PRIMARY KEY (id);


--
-- Name: cohorts PK_fd38f76b135e907b834fda1e752; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohorts
    ADD CONSTRAINT "PK_fd38f76b135e907b834fda1e752" PRIMARY KEY (id);


--
-- Name: participant_preferences REL_b88dd616329b9e1fb6835b11f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_preferences
    ADD CONSTRAINT "REL_b88dd616329b9e1fb6835b11f9" UNIQUE (participant_id);


--
-- Name: evaluations UQ_1669a1e6ca964431a1288480f77; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT "UQ_1669a1e6ca964431a1288480f77" UNIQUE (team_id, stage_id);


--
-- Name: participants UQ_21c0dc46f025572c6b99626b9eb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT "UQ_21c0dc46f025572c6b99626b9eb" UNIQUE (participant_id);


--
-- Name: mentors UQ_2968ad4001f7790e37fd82dfbcc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT "UQ_2968ad4001f7790e37fd82dfbcc" UNIQUE (email);


--
-- Name: refresh_tokens UQ_4542dd2f38a61354a040ba9fd57; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "UQ_4542dd2f38a61354a040ba9fd57" UNIQUE (token);


--
-- Name: organizations UQ_4ad920935f4d4eb73fc58b40f72; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_4ad920935f4d4eb73fc58b40f72" UNIQUE (email);


--
-- Name: team_members UQ_6c3ad5a50bfcff2da3fb97f0ab5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "UQ_6c3ad5a50bfcff2da3fb97f0ab5" UNIQUE (team_id, participant_id);


--
-- Name: team_invitations UQ_800218d2077505c0c3751b66b07; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "UQ_800218d2077505c0c3751b66b07" UNIQUE (team_id, participant_id, status);


--
-- Name: peer_review_assignments UQ_8a4e060cc06322c96b37603a892; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "UQ_8a4e060cc06322c96b37603a892" UNIQUE (reviewer_team_id, reviewed_team_id, stage_id);


--
-- Name: teams UQ_8ad3974a1c9c97a4c2fcf36d952; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "UQ_8ad3974a1c9c97a4c2fcf36d952" UNIQUE (invite_code);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: journal_entries UQ_a03aaa26115da548dc9fa59c7f0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "UQ_a03aaa26115da548dc9fa59c7f0" UNIQUE (team_id, week_number);


--
-- Name: certificates UQ_b35f08e322d1ac3af0f41c76dbb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "UQ_b35f08e322d1ac3af0f41c76dbb" UNIQUE (certificate_id);


--
-- Name: participants UQ_b77ad0832a0f8ec526c1f40a842; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT "UQ_b77ad0832a0f8ec526c1f40a842" UNIQUE (email);


--
-- Name: IDX_00ef81b6f1d3bf605ab505e5eb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_00ef81b6f1d3bf605ab505e5eb" ON public.scheduled_sessions USING btree (claim_id);


--
-- Name: IDX_041d520a79f76e0de26613cbe8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_041d520a79f76e0de26613cbe8" ON public.activity_logs USING btree (cohort_id, created_at);


--
-- Name: IDX_0572b65800b7bc75757975f0bc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0572b65800b7bc75757975f0bc" ON public.cohorts USING btree (status);


--
-- Name: IDX_0c4ac86557ef058fd469848fef; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0c4ac86557ef058fd469848fef" ON public.submission_history USING btree (submission_id);


--
-- Name: IDX_0f680297e7fb9d023697716f04; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0f680297e7fb9d023697716f04" ON public.mentor_availability USING btree (mentor_id, day_of_week);


--
-- Name: IDX_1122f6529421afea06b88f7f53; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_1122f6529421afea06b88f7f53" ON public.message_reactions USING btree (message_id, reactor_id, reactor_type, emoji);


--
-- Name: IDX_124a1a99f0cc1f9bfb524f2044; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_124a1a99f0cc1f9bfb524f2044" ON public.notification_preferences USING btree (user_id, user_type);


--
-- Name: IDX_1669a1e6ca964431a1288480f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1669a1e6ca964431a1288480f7" ON public.evaluations USING btree (team_id, stage_id);


--
-- Name: IDX_177183f29f438c488b5e8510cd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON public.audit_logs USING btree (actor_id);


--
-- Name: IDX_1fa31efc2a0bc0b517b9f7225d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1fa31efc2a0bc0b517b9f7225d" ON public.activity_logs USING btree (created_at);


--
-- Name: IDX_21c0dc46f025572c6b99626b9e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_21c0dc46f025572c6b99626b9e" ON public.participants USING btree (participant_id);


--
-- Name: IDX_22a8ceffff1ef5bcfdecfe25d3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22a8ceffff1ef5bcfdecfe25d3" ON public.activity_logs USING btree (user_id, created_at);


--
-- Name: IDX_22de208474400628c26a197c4d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22de208474400628c26a197c4d" ON public.mentor_availability_exceptions USING btree (mentor_id, date);


--
-- Name: IDX_2317870c486f74c15a9a9764aa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2317870c486f74c15a9a9764aa" ON public.mentor_sessions USING btree (mentor_id);


--
-- Name: IDX_23919db37f385d2d5c2c1d776a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_23919db37f385d2d5c2c1d776a" ON public.notifications USING btree (recipient_id, recipient_type, created_at);


--
-- Name: IDX_23b2c133545fe1f8d62ffbecda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_23b2c133545fe1f8d62ffbecda" ON public.participants USING btree (cohort_id, status);


--
-- Name: IDX_23def138b95e00cc3f138d78f8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_23def138b95e00cc3f138d78f8" ON public.evaluation_jobs USING btree (team_id, stage_id);


--
-- Name: IDX_28e66b3adfbea001b3066d2320; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_28e66b3adfbea001b3066d2320" ON public.resources USING btree (is_published);


--
-- Name: IDX_2968ad4001f7790e37fd82dfbc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2968ad4001f7790e37fd82dfbc" ON public.mentors USING btree (email);


--
-- Name: IDX_2cd10fda8276bb995288acfbfb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at);


--
-- Name: IDX_32832006b4373dc9f2a4c31dbb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_32832006b4373dc9f2a4c31dbb" ON public.mentor_assignments USING btree (team_id);


--
-- Name: IDX_347b86ce72f8ad5e0167d31f1d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_347b86ce72f8ad5e0167d31f1d" ON public.forum_threads USING btree (author_id, author_type);


--
-- Name: IDX_35e504bebcd1975aea3063c3c0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_35e504bebcd1975aea3063c3c0" ON public.mentor_availability USING btree (mentor_id);


--
-- Name: IDX_36ee172ac0dd4568d543dfaabf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_36ee172ac0dd4568d543dfaabf" ON public.chat_messages USING btree (channel_id, created_at);


--
-- Name: IDX_3a6c060ef6d2c744aa8a30c32d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3a6c060ef6d2c744aa8a30c32d" ON public.team_member_removal_requests USING btree (status);


--
-- Name: IDX_3b71b1fccadf73dc8d32517396; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b71b1fccadf73dc8d32517396" ON public.verification_codes USING btree (email);


--
-- Name: IDX_3d5db697586f725c72be6d7489; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3d5db697586f725c72be6d7489" ON public.team_members USING btree (participant_id);


--
-- Name: IDX_418296f67a1adab60eac125786; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_418296f67a1adab60eac125786" ON public.forum_categories USING btree (cohort_id, sort_order);


--
-- Name: IDX_44388485e1086c9d3ce18b9cea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_44388485e1086c9d3ce18b9cea" ON public.journal_entries USING btree (cohort_id, week_number);


--
-- Name: IDX_4542dd2f38a61354a040ba9fd5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_4542dd2f38a61354a040ba9fd5" ON public.refresh_tokens USING btree (token);


--
-- Name: IDX_46d2341dda6f1703a7224c9d98; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_46d2341dda6f1703a7224c9d98" ON public.forum_replies USING btree (parent_reply_id);


--
-- Name: IDX_47d9ff0726cf20571e29480a99; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_47d9ff0726cf20571e29480a99" ON public.team_invitations USING btree (team_id);


--
-- Name: IDX_495884ef2de007cfd4302f87fd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_495884ef2de007cfd4302f87fd" ON public.mentor_claims USING btree (status);


--
-- Name: IDX_4ab2d7d6ba3a03e7353e1a5cc4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4ab2d7d6ba3a03e7353e1a5cc4" ON public.mentor_sessions USING btree (session_date);


--
-- Name: IDX_4ad920935f4d4eb73fc58b40f7; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_4ad920935f4d4eb73fc58b40f7" ON public.organizations USING btree (email);


--
-- Name: IDX_4c9eee65dd51f3bdb1cc5440f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4c9eee65dd51f3bdb1cc5440f0" ON public.activity_logs USING btree (activity_type, created_at);


--
-- Name: IDX_4e636853a4b027e6c79fb2b5f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4e636853a4b027e6c79fb2b5f3" ON public.peer_review_assignments USING btree (reviewer_team_id, status);


--
-- Name: IDX_4e90a5881ac435f233569d2d8f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_4e90a5881ac435f233569d2d8f" ON public.verticals USING btree (cohort_id, name);


--
-- Name: IDX_523a91dc5cde3179f67f629b8b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_523a91dc5cde3179f67f629b8b" ON public.stages USING btree (cohort_id, number);


--
-- Name: IDX_5678071b4eb67f744a9f88aa69; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5678071b4eb67f744a9f88aa69" ON public.evaluation_jobs USING btree (created_at);


--
-- Name: IDX_57feafedbe84d23194bd87449f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_57feafedbe84d23194bd87449f" ON public.scheduled_sessions USING btree (team_id);


--
-- Name: IDX_5826ae9d01e1d0f32a4016dc6a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5826ae9d01e1d0f32a4016dc6a" ON public.scheduled_sessions USING btree (mentor_id);


--
-- Name: IDX_58e467b9f4def82cc27611227a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_58e467b9f4def82cc27611227a" ON public.briefs USING btree (session_id);


--
-- Name: IDX_59962705b9a46c40bfd5a256ec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_59962705b9a46c40bfd5a256ec" ON public.peer_reviews USING btree (submitted_at);


--
-- Name: IDX_6091bf8e4f32a7b2634eebbf4b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6091bf8e4f32a7b2634eebbf4b" ON public.github_analyses USING btree (team_id);


--
-- Name: IDX_60ba2ad70135b2045f4306ee06; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_60ba2ad70135b2045f4306ee06" ON public.activity_logs USING btree (portal, created_at);


--
-- Name: IDX_62b1f3f605497c7edeea6d200e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62b1f3f605497c7edeea6d200e" ON public.organizations USING btree (public_submission);


--
-- Name: IDX_6a71c4ebd99776f7639aa30b6d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6a71c4ebd99776f7639aa30b6d" ON public.peer_review_assignments USING btree (cohort_id, stage_id);


--
-- Name: IDX_717c65f49a2859c493e5e41e7f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_717c65f49a2859c493e5e41e7f" ON public.mentor_availability_exceptions USING btree (mentor_id);


--
-- Name: IDX_71a10831469775a1effdd85f24; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_71a10831469775a1effdd85f24" ON public.channel_members USING btree (channel_id);


--
-- Name: IDX_72e532cc451709d6a4b418c71e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_72e532cc451709d6a4b418c71e" ON public.channel_members USING btree (channel_id, member_id, member_type);


--
-- Name: IDX_74142cc502f243504075d18a55; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_74142cc502f243504075d18a55" ON public.github_analyses USING btree (submission_id);


--
-- Name: IDX_7421efc125d95e413657efa3c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: IDX_750301b794881f7382d242b970; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_750301b794881f7382d242b970" ON public.activity_logs USING btree (cohort_id, activity_type, created_at);


--
-- Name: IDX_784cc2ac081c1c8cd623181946; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_784cc2ac081c1c8cd623181946" ON public.teams USING btree (cohort_id, status);


--
-- Name: IDX_79d151d6b7e83178abcc5c3073; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_79d151d6b7e83178abcc5c3073" ON public.forum_threads USING btree (category_id, is_pinned, created_at);


--
-- Name: IDX_7af52c0c61ff91b35777f77dd7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7af52c0c61ff91b35777f77dd7" ON public.certificates USING btree (tier);


--
-- Name: IDX_7b89b6b068f46cfb95f98e3357; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7b89b6b068f46cfb95f98e3357" ON public.briefs USING btree (organization_id);


--
-- Name: IDX_7dd11c7db3072f87516bdca486; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7dd11c7db3072f87516bdca486" ON public.notifications USING btree (type, created_at);


--
-- Name: IDX_81ecd1ba8f10d9e1c46b03ac7c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_81ecd1ba8f10d9e1c46b03ac7c" ON public.peer_reviews USING btree (assignment_id);


--
-- Name: IDX_82a50c7fbe75d46070f1c7ddb0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_82a50c7fbe75d46070f1c7ddb0" ON public.forum_categories USING btree (cohort_id, vertical_id);


--
-- Name: IDX_84ba99dcdf58dbed898f589463; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_84ba99dcdf58dbed898f589463" ON public.peer_review_rubrics USING btree (cohort_id, stage_id);


--
-- Name: IDX_851e7b2d2fdf8c21584b5fd5e7; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_851e7b2d2fdf8c21584b5fd5e7" ON public.certificates USING btree (cohort_id, participant_id);


--
-- Name: IDX_869b4a9ba2c9e030aafc4b7dc7; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_869b4a9ba2c9e030aafc4b7dc7" ON public.push_tokens USING btree (token);


--
-- Name: IDX_8e22bf9e590df393d366be2277; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8e22bf9e590df393d366be2277" ON public.team_invitations USING btree (status);


--
-- Name: IDX_8fbc8001b71fec768b70b1b83f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8fbc8001b71fec768b70b1b83f" ON public.evaluation_jobs USING btree (status);


--
-- Name: IDX_90cbe8b6aa0e521e5534c6dbb0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_90cbe8b6aa0e521e5534c6dbb0" ON public.mentor_assignments USING btree (mentor_id);


--
-- Name: IDX_938f638e7fecfe0c2ca32c8d31; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_938f638e7fecfe0c2ca32c8d31" ON public.team_member_removal_requests USING btree (team_id);


--
-- Name: IDX_948d3f59dba8a8306b56fbea0e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_948d3f59dba8a8306b56fbea0e" ON public.certificates USING btree (status);


--
-- Name: IDX_949849a6e1f5aefb3fae0c5bb1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_949849a6e1f5aefb3fae0c5bb1" ON public.mentor_payments USING btree (mentor_id);


--
-- Name: IDX_94e01f535c61a94827fece1986; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_94e01f535c61a94827fece1986" ON public.submissions USING btree (team_id, stage_id);


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- Name: IDX_9bcf74b85a1885f20045261988; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9bcf74b85a1885f20045261988" ON public.teams USING btree (brief_id);


--
-- Name: IDX_9bd4122bf7c35fb44003ded952; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9bd4122bf7c35fb44003ded952" ON public.forum_threads USING btree (category_id, last_reply_at);


--
-- Name: IDX_9e821de77edc6a3bf270d84aa5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9e821de77edc6a3bf270d84aa5" ON public.channel_members USING btree (member_id, member_type);


--
-- Name: IDX_a02d140562d4ca202677ca4f43; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a02d140562d4ca202677ca4f43" ON public.peer_review_assignments USING btree (reviewed_team_id);


--
-- Name: IDX_a03aaa26115da548dc9fa59c7f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a03aaa26115da548dc9fa59c7f" ON public.journal_entries USING btree (team_id, week_number);


--
-- Name: IDX_a10e87543b29067e1072a5bacd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_a10e87543b29067e1072a5bacd" ON public.forum_thread_views USING btree (thread_id, viewer_id, viewer_type);


--
-- Name: IDX_aa2967b241247fcc7dfd0fc67c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_aa2967b241247fcc7dfd0fc67c" ON public.journal_entries USING btree (created_at);


--
-- Name: IDX_ad22953e8673c14f506870f6f6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ad22953e8673c14f506870f6f6" ON public.team_invitations USING btree (participant_id);


--
-- Name: IDX_ad3b832a04ccc88e59a946cf64; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ad3b832a04ccc88e59a946cf64" ON public.submission_history USING btree (saved_at);


--
-- Name: IDX_ae8f648cfec0b7ba7160b272c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ae8f648cfec0b7ba7160b272c6" ON public.mentors USING btree (cohort_id, status);


--
-- Name: IDX_ae9f6c4977b93e71230407c011; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ae9f6c4977b93e71230407c011" ON public.mentor_sessions USING btree (team_id);


--
-- Name: IDX_af810ef508b28857375a3a17d8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_af810ef508b28857375a3a17d8" ON public.resources USING btree (cohort_id, type);


--
-- Name: IDX_b1b6dff0d35dd419920566316f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b1b6dff0d35dd419920566316f" ON public.submissions USING btree (stage_id, status);


--
-- Name: IDX_b35f08e322d1ac3af0f41c76db; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b35f08e322d1ac3af0f41c76db" ON public.certificates USING btree (certificate_id);


--
-- Name: IDX_b51227d934a9ec8af3efb367bd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b51227d934a9ec8af3efb367bd" ON public.brief_revisions USING btree (brief_id);


--
-- Name: IDX_b764f179cd4f98042725541a25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b764f179cd4f98042725541a25" ON public.chat_channels USING btree (cohort_id, type);


--
-- Name: IDX_b77ad0832a0f8ec526c1f40a84; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b77ad0832a0f8ec526c1f40a84" ON public.participants USING btree (email);


--
-- Name: IDX_b88dd616329b9e1fb6835b11f9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b88dd616329b9e1fb6835b11f9" ON public.participant_preferences USING btree (participant_id);


--
-- Name: IDX_bdb181c258f64d5b0a961d2b45; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bdb181c258f64d5b0a961d2b45" ON public.team_member_removal_requests USING btree (member_id);


--
-- Name: IDX_c0de16a8c11de4df6c7ecfed64; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c0de16a8c11de4df6c7ecfed64" ON public.briefs USING btree (cohort_id, status);


--
-- Name: IDX_c2daab9ae26a0aabff9f9095da; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c2daab9ae26a0aabff9f9095da" ON public.mentor_payments USING btree (paid_at);


--
-- Name: IDX_c8f299b7f4b1a53e80754c8d39; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c8f299b7f4b1a53e80754c8d39" ON public.scheduled_sessions USING btree (google_event_id);


--
-- Name: IDX_c9fca81a9cba214c91f07f082c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c9fca81a9cba214c91f07f082c" ON public.mentor_payments USING btree (status);


--
-- Name: IDX_cc337ab94ccb21ee6e6411dcb8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cc337ab94ccb21ee6e6411dcb8" ON public.scheduled_sessions USING btree (scheduled_at);


--
-- Name: IDX_cc9ba6065f273573438a678bc2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cc9ba6065f273573438a678bc2" ON public.mentor_payments USING btree (created_at);


--
-- Name: IDX_ce61e365d81a9dfc15cd36513b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ce61e365d81a9dfc15cd36513b" ON public.message_reactions USING btree (message_id);


--
-- Name: IDX_cf222f345c149c8df50942588f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf222f345c149c8df50942588f" ON public.typing_indicators USING btree (channel_id);


--
-- Name: IDX_d227793df80cfee8d11aeceaf1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d227793df80cfee8d11aeceaf1" ON public.participants USING btree (cohort_id, country);


--
-- Name: IDX_d4674f9d90f1c4d7cde198457e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d4674f9d90f1c4d7cde198457e" ON public.evaluations USING btree (cohort_id, stage_id);


--
-- Name: IDX_d5a67e0548ff902169d4435527; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d5a67e0548ff902169d4435527" ON public.mentor_claims USING btree (team_id);


--
-- Name: IDX_d8c934213d7c5046c7c0307858; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d8c934213d7c5046c7c0307858" ON public.forum_replies USING btree (thread_id, created_at);


--
-- Name: IDX_e068ba36274f2f20aee652695a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e068ba36274f2f20aee652695a" ON public.briefs USING btree (vertical_id);


--
-- Name: IDX_e16e11d0aa2c943f0886482de1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e16e11d0aa2c943f0886482de1" ON public.github_analyses USING btree (analyzed_at);


--
-- Name: IDX_e19d1690c808021c7f60166888; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e19d1690c808021c7f60166888" ON public.resources USING btree (cohort_id, vertical_id);


--
-- Name: IDX_e1eae35a8ff8efcc508a3e0eb0; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_e1eae35a8ff8efcc508a3e0eb0" ON public.mentor_assignments USING btree (mentor_id, team_id);


--
-- Name: IDX_e25e75ed85ca1ba8b32fde8d17; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e25e75ed85ca1ba8b32fde8d17" ON public.submissions USING btree (submitted_at);


--
-- Name: IDX_e59cfb4ce9deac3c9411eaa0e0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e59cfb4ce9deac3c9411eaa0e0" ON public.refresh_tokens USING btree ("userId", "isRevoked");


--
-- Name: IDX_e82adb77c58dc7c438901b5fae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e82adb77c58dc7c438901b5fae" ON public.chat_messages USING btree (sender_id, sender_type);


--
-- Name: IDX_e8cad42997b121f3facce116d5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e8cad42997b121f3facce116d5" ON public.forum_replies USING btree (author_id, author_type);


--
-- Name: IDX_ea8ac47a73b0c5ee08ea475e1d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ea8ac47a73b0c5ee08ea475e1d" ON public.mentor_claims USING btree (mentor_id);


--
-- Name: IDX_ef2d3488875cb7728f5375c766; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_ef2d3488875cb7728f5375c766" ON public.organization_users USING btree (organization_id, user_id);


--
-- Name: IDX_effc961ee9cda9143ea481c3b7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_effc961ee9cda9143ea481c3b7" ON public.push_tokens USING btree (user_id, user_type);


--
-- Name: IDX_f221a7c07ff8e93e5cb9465215; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f221a7c07ff8e93e5cb9465215" ON public.chat_channels USING btree (team_id);


--
-- Name: IDX_f69e1861bc99e55016fcde7ada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f69e1861bc99e55016fcde7ada" ON public.stages USING btree (cohort_id, is_active);


--
-- Name: IDX_face09c725d6a7d7194a4f5478; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_face09c725d6a7d7194a4f5478" ON public.notifications USING btree (recipient_id, recipient_type, is_read, created_at);


--
-- Name: IDX_fdad7d5768277e60c40e01cdce; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fdad7d5768277e60c40e01cdce" ON public.team_members USING btree (team_id);


--
-- Name: scheduled_sessions FK_00ef81b6f1d3bf605ab505e5eb7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT "FK_00ef81b6f1d3bf605ab505e5eb7" FOREIGN KEY (claim_id) REFERENCES public.mentor_claims(id) ON DELETE CASCADE;


--
-- Name: organization_users FK_095c5c2bd5c0e3d7e899e5b20e6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_users
    ADD CONSTRAINT "FK_095c5c2bd5c0e3d7e899e5b20e6" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: verification_codes FK_0a53c41a810420ee446082ce6c6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT "FK_0a53c41a810420ee446082ce6c6" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: journal_entries FK_0b2a93dabfffac0661870c2ca8d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_0b2a93dabfffac0661870c2ca8d" FOREIGN KEY (author_id) REFERENCES public.participants(id);


--
-- Name: activity_logs FK_0b79dfe793d8b7878b2d27ac511; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "FK_0b79dfe793d8b7878b2d27ac511" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: chat_channels FK_0b8d2a132079261263bbb7df505; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT "FK_0b8d2a132079261263bbb7df505" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: submission_history FK_0c4ac86557ef058fd469848fef3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submission_history
    ADD CONSTRAINT "FK_0c4ac86557ef058fd469848fef3" FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: organizations FK_0df1ef5179634bb7956169e8318; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "FK_0df1ef5179634bb7956169e8318" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: stages FK_126bae38d3b9efe4b7a0d79eb7b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT "FK_126bae38d3b9efe4b7a0d79eb7b" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: briefs FK_16c2833936402ef6eff56c9735d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.briefs
    ADD CONSTRAINT "FK_16c2833936402ef6eff56c9735d" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: audit_logs FK_177183f29f438c488b5e8510cdb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: announcements FK_197a06ce0989e489974fdc26ca8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT "FK_197a06ce0989e489974fdc26ca8" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mentor_sessions FK_2317870c486f74c15a9a9764aac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_sessions
    ADD CONSTRAINT "FK_2317870c486f74c15a9a9764aac" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: evaluation_jobs FK_28ca399fe97d415626d9dfbe92f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_jobs
    ADD CONSTRAINT "FK_28ca399fe97d415626d9dfbe92f" FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: chat_messages FK_31c45c915d0e437e80a63b17749; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "FK_31c45c915d0e437e80a63b17749" FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: mentor_assignments FK_32832006b4373dc9f2a4c31dbb0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_assignments
    ADD CONSTRAINT "FK_32832006b4373dc9f2a4c31dbb0" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: mentor_availability FK_35e504bebcd1975aea3063c3c0f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_availability
    ADD CONSTRAINT "FK_35e504bebcd1975aea3063c3c0f" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: evaluation_jobs FK_39ec4b2f49e0493fb6020c72573; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_jobs
    ADD CONSTRAINT "FK_39ec4b2f49e0493fb6020c72573" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: team_members FK_3d5db697586f725c72be6d7489b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_3d5db697586f725c72be6d7489b" FOREIGN KEY (participant_id) REFERENCES public.participants(id);


--
-- Name: forum_categories FK_3d8e392d47594a0ea368181bad4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT "FK_3d8e392d47594a0ea368181bad4" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: peer_review_assignments FK_444bb68f7f933a001b1e843be64; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "FK_444bb68f7f933a001b1e843be64" FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: peer_review_assignments FK_44cf246e734ae18fcd020a740de; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "FK_44cf246e734ae18fcd020a740de" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: chat_messages FK_46d19cf514d5c46a1f15598cf1c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "FK_46d19cf514d5c46a1f15598cf1c" FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id);


--
-- Name: forum_replies FK_46d2341dda6f1703a7224c9d984; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT "FK_46d2341dda6f1703a7224c9d984" FOREIGN KEY (parent_reply_id) REFERENCES public.forum_replies(id);


--
-- Name: team_invitations FK_47d9ff0726cf20571e29480a99b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_47d9ff0726cf20571e29480a99b" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: forum_threads FK_5099ddd3090752a2c3b5491e31f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT "FK_5099ddd3090752a2c3b5491e31f" FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE CASCADE;


--
-- Name: scheduled_sessions FK_57feafedbe84d23194bd87449fb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT "FK_57feafedbe84d23194bd87449fb" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: scheduled_sessions FK_5826ae9d01e1d0f32a4016dc6af; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_sessions
    ADD CONSTRAINT "FK_5826ae9d01e1d0f32a4016dc6af" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: github_analyses FK_6091bf8e4f32a7b2634eebbf4bc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_analyses
    ADD CONSTRAINT "FK_6091bf8e4f32a7b2634eebbf4bc" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: refresh_tokens FK_610102b60fea1455310ccd299de; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team_member_removal_requests FK_683974b160e897cabc34a9fd21f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_removal_requests
    ADD CONSTRAINT "FK_683974b160e897cabc34a9fd21f" FOREIGN KEY (participant_id) REFERENCES public.participants(id);


--
-- Name: resources FK_69503a2c044bb575f1fdfaac4d1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT "FK_69503a2c044bb575f1fdfaac4d1" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: journal_entries FK_6b73f59ebe53ba257f27d7ad616; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_6b73f59ebe53ba257f27d7ad616" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: forum_replies FK_6cd45ccf838f58873a3ab024f37; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT "FK_6cd45ccf838f58873a3ab024f37" FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;


--
-- Name: mentors FK_6e75367ff743e86f06efb66b498; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentors
    ADD CONSTRAINT "FK_6e75367ff743e86f06efb66b498" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: mentor_availability_exceptions FK_717c65f49a2859c493e5e41e7fe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_availability_exceptions
    ADD CONSTRAINT "FK_717c65f49a2859c493e5e41e7fe" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: channel_members FK_71a10831469775a1effdd85f240; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_members
    ADD CONSTRAINT "FK_71a10831469775a1effdd85f240" FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE;


--
-- Name: github_analyses FK_74142cc502f243504075d18a551; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_analyses
    ADD CONSTRAINT "FK_74142cc502f243504075d18a551" FOREIGN KEY (submission_id) REFERENCES public.submissions(id);


--
-- Name: submissions FK_744e0ddbe7ee244176b7bd1dd44; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT "FK_744e0ddbe7ee244176b7bd1dd44" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: certificates FK_74f793aec1816e366ff482d3d6b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "FK_74f793aec1816e366ff482d3d6b" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: evaluations FK_7726f7c338e156d832e722cd733; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT "FK_7726f7c338e156d832e722cd733" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: evaluations FK_78be7555369c0df090531d1930c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT "FK_78be7555369c0df090531d1930c" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: briefs FK_7b89b6b068f46cfb95f98e33571; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.briefs
    ADD CONSTRAINT "FK_7b89b6b068f46cfb95f98e33571" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: peer_reviews FK_81ecd1ba8f10d9e1c46b03ac7cd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_reviews
    ADD CONSTRAINT "FK_81ecd1ba8f10d9e1c46b03ac7cd" FOREIGN KEY (assignment_id) REFERENCES public.peer_review_assignments(id);


--
-- Name: peer_reviews FK_83e48f57f9272ac2850d02d916f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_reviews
    ADD CONSTRAINT "FK_83e48f57f9272ac2850d02d916f" FOREIGN KEY (reviewer_participant_id) REFERENCES public.participants(id);


--
-- Name: verification_codes FK_87fb1e0b03825ae6092f2647fa6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT "FK_87fb1e0b03825ae6092f2647fa6" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: submissions FK_8b44731fd053ed70dab7a0e5b57; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT "FK_8b44731fd053ed70dab7a0e5b57" FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: forum_thread_views FK_8b5c3060f703664d52098645275; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_thread_views
    ADD CONSTRAINT "FK_8b5c3060f703664d52098645275" FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;


--
-- Name: peer_review_rubrics FK_8c3b031f675ea82021a8fb5c622; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_rubrics
    ADD CONSTRAINT "FK_8c3b031f675ea82021a8fb5c622" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: mentor_assignments FK_90cbe8b6aa0e521e5534c6dbb00; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_assignments
    ADD CONSTRAINT "FK_90cbe8b6aa0e521e5534c6dbb00" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: team_invitations FK_92d21809e16a56887210bb4dbc5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_92d21809e16a56887210bb4dbc5" FOREIGN KEY (invited_by) REFERENCES public.participants(id);


--
-- Name: team_member_removal_requests FK_938f638e7fecfe0c2ca32c8d31e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_removal_requests
    ADD CONSTRAINT "FK_938f638e7fecfe0c2ca32c8d31e" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: mentor_payments FK_949849a6e1f5aefb3fae0c5bb17; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_payments
    ADD CONSTRAINT "FK_949849a6e1f5aefb3fae0c5bb17" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: evaluation_jobs FK_97969229b7c32ce08f90b1ce026; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_jobs
    ADD CONSTRAINT "FK_97969229b7c32ce08f90b1ce026" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: resources FK_99c5b0839137190943151560f56; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT "FK_99c5b0839137190943151560f56" FOREIGN KEY (vertical_id) REFERENCES public.verticals(id);


--
-- Name: teams FK_9bcf74b85a1885f20045261988a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "FK_9bcf74b85a1885f20045261988a" FOREIGN KEY (brief_id) REFERENCES public.briefs(id);


--
-- Name: announcements FK_9cd4bcf1b65ef264d4e16f88854; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT "FK_9cd4bcf1b65ef264d4e16f88854" FOREIGN KEY ("cohortId") REFERENCES public.cohorts(id) ON DELETE CASCADE;


--
-- Name: peer_review_assignments FK_a02d140562d4ca202677ca4f43e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "FK_a02d140562d4ca202677ca4f43e" FOREIGN KEY (reviewed_team_id) REFERENCES public.teams(id);


--
-- Name: participant_preferences FK_a17558ad164af350022631f8014; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_preferences
    ADD CONSTRAINT "FK_a17558ad164af350022631f8014" FOREIGN KEY (vertical_id_2) REFERENCES public.verticals(id);


--
-- Name: team_invitations FK_ad22953e8673c14f506870f6f67; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT "FK_ad22953e8673c14f506870f6f67" FOREIGN KEY (participant_id) REFERENCES public.participants(id);


--
-- Name: mentor_sessions FK_ae9f6c4977b93e71230407c0110; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_sessions
    ADD CONSTRAINT "FK_ae9f6c4977b93e71230407c0110" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams FK_b392df7c8c150fb68ffd26a431b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "FK_b392df7c8c150fb68ffd26a431b" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: brief_revisions FK_b51227d934a9ec8af3efb367bd2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brief_revisions
    ADD CONSTRAINT "FK_b51227d934a9ec8af3efb367bd2" FOREIGN KEY (brief_id) REFERENCES public.briefs(id);


--
-- Name: peer_review_assignments FK_b7302803424400d72c9db8ee2f4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_assignments
    ADD CONSTRAINT "FK_b7302803424400d72c9db8ee2f4" FOREIGN KEY (reviewer_team_id) REFERENCES public.teams(id);


--
-- Name: participant_preferences FK_b88dd616329b9e1fb6835b11f95; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_preferences
    ADD CONSTRAINT "FK_b88dd616329b9e1fb6835b11f95" FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: team_member_removal_requests FK_bdb181c258f64d5b0a961d2b45f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_removal_requests
    ADD CONSTRAINT "FK_bdb181c258f64d5b0a961d2b45f" FOREIGN KEY (member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: journal_entries FK_c0b01a7eb2aa8e30af2d7dcf4c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_c0b01a7eb2aa8e30af2d7dcf4c2" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: evaluations FK_c221b5e929724fbc162d2d950fe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT "FK_c221b5e929724fbc162d2d950fe" FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: team_member_removal_requests FK_c49c02e491fe8d62a31ef273077; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_removal_requests
    ADD CONSTRAINT "FK_c49c02e491fe8d62a31ef273077" FOREIGN KEY (requested_by) REFERENCES public.participants(id);


--
-- Name: participant_preferences FK_cd473420cfb9b164a142dc87148; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_preferences
    ADD CONSTRAINT "FK_cd473420cfb9b164a142dc87148" FOREIGN KEY (vertical_id_1) REFERENCES public.verticals(id);


--
-- Name: message_reactions FK_ce61e365d81a9dfc15cd36513b0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT "FK_ce61e365d81a9dfc15cd36513b0" FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;


--
-- Name: certificates FK_cfa8eb1186b124337f7d6dfcca1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "FK_cfa8eb1186b124337f7d6dfcca1" FOREIGN KEY (participant_id) REFERENCES public.participants(id);


--
-- Name: peer_review_rubrics FK_d467a025b0ee328452cdb5c08c0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.peer_review_rubrics
    ADD CONSTRAINT "FK_d467a025b0ee328452cdb5c08c0" FOREIGN KEY (stage_id) REFERENCES public.stages(id);


--
-- Name: activity_logs FK_d54f841fa5478e4734590d44036; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT "FK_d54f841fa5478e4734590d44036" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: mentor_claims FK_d5a67e0548ff902169d44355270; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_claims
    ADD CONSTRAINT "FK_d5a67e0548ff902169d44355270" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: certificates FK_d7609db7f51e86bfe1163d6984f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "FK_d7609db7f51e86bfe1163d6984f" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: participants FK_dec0f45e3137be378c222af9e3f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT "FK_dec0f45e3137be378c222af9e3f" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);


--
-- Name: briefs FK_e068ba36274f2f20aee652695a9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.briefs
    ADD CONSTRAINT "FK_e068ba36274f2f20aee652695a9" FOREIGN KEY (vertical_id) REFERENCES public.verticals(id);


--
-- Name: verticals FK_e9ffecf9a43f6d8185e8f3f3fd1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verticals
    ADD CONSTRAINT "FK_e9ffecf9a43f6d8185e8f3f3fd1" FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id) ON DELETE CASCADE;


--
-- Name: mentor_claims FK_ea8ac47a73b0c5ee08ea475e1d3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentor_claims
    ADD CONSTRAINT "FK_ea8ac47a73b0c5ee08ea475e1d3" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id) ON DELETE CASCADE;


--
-- Name: teams FK_eed7fcfa464fd974cfa0ad35449; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "FK_eed7fcfa464fd974cfa0ad35449" FOREIGN KEY (mentor_id) REFERENCES public.mentors(id);


--
-- Name: chat_channels FK_f221a7c07ff8e93e5cb94652151; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_channels
    ADD CONSTRAINT "FK_f221a7c07ff8e93e5cb94652151" FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: team_members FK_fdad7d5768277e60c40e01cdcea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT "FK_fdad7d5768277e60c40e01cdcea" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



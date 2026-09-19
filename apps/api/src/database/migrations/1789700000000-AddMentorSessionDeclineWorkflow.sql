-- Migration: AddMentorSessionDeclineWorkflow
-- Run this SQL directly in your PostgreSQL database

-- 1. Add 'declined' value to scheduled_session_status enum
ALTER TYPE "public"."scheduled_sessions_status_enum" 
ADD VALUE IF NOT EXISTS 'declined';

-- 2. Add declined_at column to scheduled_sessions
ALTER TABLE "scheduled_sessions" 
ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMP;

-- 3. Add decline_reason column to scheduled_sessions
ALTER TABLE "scheduled_sessions" 
ADD COLUMN IF NOT EXISTS "decline_reason" character varying;

-- 4. Add new notification types to notification_type enum
ALTER TYPE "public"."notifications_type_enum" 
ADD VALUE IF NOT EXISTS 'mentor_session_requested';

ALTER TYPE "public"."notifications_type_enum" 
ADD VALUE IF NOT EXISTS 'mentor_session_confirmed';

ALTER TYPE "public"."notifications_type_enum" 
ADD VALUE IF NOT EXISTS 'mentor_session_declined';

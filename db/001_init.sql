CREATE TABLE IF NOT EXISTS zora_cases (
  id uuid PRIMARY KEY,
  title text NOT NULL, client text NOT NULL, workflow text NOT NULL CHECK (workflow IN ('W1','W2','W3','W4','W5','W6','W7','W8')),
  status text NOT NULL CHECK (status IN ('awaiting_confirmation','queued','running','awaiting_approval','blocked','released')),
  stage_index integer NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 1,
  source text NOT NULL CHECK (source IN ('manual','email')),
  requested_by text NOT NULL, briefing text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_jobs (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  stage_id text NOT NULL, case_version integer NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','leased','completed','blocked')),
  lease_id uuid, lease_expires_at timestamptz, worker_id text,
  result jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
-- zora:statement-breakpoint
CREATE INDEX IF NOT EXISTS zora_jobs_queue ON zora_jobs(state, created_at);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_sources (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  filename text NOT NULL, mime_type text NOT NULL, data bytea NOT NULL, sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id, sha256)
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id uuid REFERENCES zora_cases(id),
  type text NOT NULL, actor text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  stage_id text NOT NULL, version integer NOT NULL, actor text NOT NULL, role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id, stage_id, version, role)
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_mail_state (
  mailbox text PRIMARY KEY, folder_id text NOT NULL, subscription_id text,
  subscription_expires_at timestamptz, delta_link text, last_sync_at timestamptz,
  syncing_until timestamptz
);
-- zora:statement-breakpoint
ALTER TABLE zora_mail_state ADD COLUMN IF NOT EXISTS sync_lease uuid;
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_mail_receipts (
  mailbox text NOT NULL, message_id text NOT NULL, case_id uuid REFERENCES zora_cases(id),
  disposition text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(mailbox,message_id)
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_artifacts (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id), job_id uuid NOT NULL REFERENCES zora_jobs(id),
  filename text NOT NULL, mime_type text NOT NULL, visibility text NOT NULL CHECK(visibility IN ('client','internal')),
  data bytea NOT NULL, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_inbox (
  id uuid PRIMARY KEY, mailbox text NOT NULL, message_id text NOT NULL,
  subject text NOT NULL, sender text NOT NULL, body_text text NOT NULL,
  received_at timestamptz NOT NULL, case_id uuid REFERENCES zora_cases(id),
  attachment_notice text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(mailbox,message_id)
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_mail_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, mailbox text NOT NULL,
  kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
-- zora:statement-breakpoint
ALTER TABLE zora_cases ADD COLUMN IF NOT EXISTS source_revision integer NOT NULL DEFAULT 1;
-- zora:statement-breakpoint
ALTER TABLE zora_jobs ADD COLUMN IF NOT EXISTS source_revision integer NOT NULL DEFAULT 1;
-- zora:statement-breakpoint
ALTER TABLE zora_sources ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}';
-- zora:statement-breakpoint
ALTER TABLE zora_artifacts ADD COLUMN IF NOT EXISTS source_path text;
-- zora:statement-breakpoint
ALTER TABLE zora_artifacts ADD COLUMN IF NOT EXISTS lease_id uuid;
-- zora:statement-breakpoint
ALTER TABLE zora_artifacts ADD COLUMN IF NOT EXISTS case_version integer NOT NULL DEFAULT 1;
-- zora:statement-breakpoint
ALTER TABLE zora_artifacts ADD COLUMN IF NOT EXISTS source_revision integer NOT NULL DEFAULT 1;
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_case_members (
  case_id uuid NOT NULL REFERENCES zora_cases(id), email text NOT NULL, added_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,email)
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_uploads (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id), job_id uuid REFERENCES zora_jobs(id),
  kind text NOT NULL CHECK(kind IN ('source','artifact')), owner text NOT NULL, lease_id uuid,
  filename text NOT NULL, mime_type text NOT NULL, visibility text NOT NULL DEFAULT 'internal', source_path text,
  total_bytes integer NOT NULL CHECK(total_bytes>0 AND total_bytes<=33554432), sha256 text NOT NULL,
  data bytea NOT NULL DEFAULT ''::bytea, next_offset integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','completed')),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '2 hours'
);
-- zora:statement-breakpoint
ALTER TABLE zora_uploads ADD COLUMN IF NOT EXISTS case_version integer;
-- zora:statement-breakpoint
ALTER TABLE zora_cases ADD COLUMN IF NOT EXISTS qc_clean_loops integer;
-- zora:statement-breakpoint
ALTER TABLE zora_cases ADD COLUMN IF NOT EXISTS qc_max_loops integer;
-- zora:statement-breakpoint
ALTER TABLE zora_jobs ADD COLUMN IF NOT EXISTS context_id text;
-- zora:statement-breakpoint
ALTER TABLE zora_jobs DROP CONSTRAINT IF EXISTS zora_jobs_state_check;
-- zora:statement-breakpoint
ALTER TABLE zora_jobs ADD CONSTRAINT zora_jobs_state_check CHECK(state IN ('queued','leased','reviewing','completed','blocked'));
-- zora:statement-breakpoint
ALTER TABLE zora_artifacts ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'workpaper';
-- zora:statement-breakpoint
ALTER TABLE zora_uploads ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'workpaper';
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_qc_runs (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id), job_id uuid NOT NULL REFERENCES zora_jobs(id),
  case_version integer NOT NULL, source_revision integer NOT NULL, creator_context text NOT NULL,
  state text NOT NULL DEFAULT 'reviewing' CHECK(state IN ('reviewing','blocked','passed')),
  packet jsonb NOT NULL, packet_hash text NOT NULL, loop_number integer NOT NULL DEFAULT 1,
  clean_streak integer NOT NULL DEFAULT 0, clean_loops integer, max_loops integer,
  missing_inputs jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_reviews (
  id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES zora_qc_runs(id), case_id uuid NOT NULL REFERENCES zora_cases(id),
  checker text NOT NULL, pass_number integer NOT NULL, method text NOT NULL, loop_number integer NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','completed','blocked')),
  context_id text, worker_id text, lease_id uuid, lease_expires_at timestamptz, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(run_id,loop_number,checker,pass_number)
);
-- zora:statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS zora_reviews_fresh_context ON zora_reviews(case_id,context_id) WHERE context_id IS NOT NULL;
-- zora:statement-breakpoint
CREATE TABLE IF NOT EXISTS zora_review_contexts (
  case_id uuid NOT NULL REFERENCES zora_cases(id), context_id text NOT NULL, review_id uuid NOT NULL REFERENCES zora_reviews(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,context_id)
);
-- zora:statement-breakpoint
ALTER TABLE zora_reviews ADD COLUMN IF NOT EXISTS sequence integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS zora_cases (
  id uuid PRIMARY KEY,
  title text NOT NULL, client text NOT NULL, workflow text NOT NULL CHECK (workflow IN ('W1','W2','W3','W4','W5','W6','W7','W8')),
  status text NOT NULL CHECK (status IN ('awaiting_confirmation','queued','running','awaiting_approval','blocked','released')),
  stage_index integer NOT NULL DEFAULT 0, version integer NOT NULL DEFAULT 1,
  source text NOT NULL CHECK (source IN ('manual','email')),
  requested_by text NOT NULL, briefing text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zora_jobs (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  stage_id text NOT NULL, case_version integer NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','leased','completed','blocked')),
  lease_id uuid, lease_expires_at timestamptz, worker_id text,
  result jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS zora_jobs_queue ON zora_jobs(state, created_at);
CREATE TABLE IF NOT EXISTS zora_sources (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  filename text NOT NULL, mime_type text NOT NULL, data bytea NOT NULL, sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id, sha256)
);
CREATE TABLE IF NOT EXISTS zora_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id uuid REFERENCES zora_cases(id),
  type text NOT NULL, actor text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zora_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id),
  stage_id text NOT NULL, version integer NOT NULL, actor text NOT NULL, role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id, stage_id, version, role)
);
CREATE TABLE IF NOT EXISTS zora_mail_state (
  mailbox text PRIMARY KEY, folder_id text NOT NULL, subscription_id text,
  subscription_expires_at timestamptz, delta_link text, last_sync_at timestamptz,
  syncing_until timestamptz
);
ALTER TABLE zora_mail_state ADD COLUMN IF NOT EXISTS sync_lease uuid;
CREATE TABLE IF NOT EXISTS zora_mail_receipts (
  mailbox text NOT NULL, message_id text NOT NULL, case_id uuid REFERENCES zora_cases(id),
  disposition text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(mailbox,message_id)
);
CREATE TABLE IF NOT EXISTS zora_artifacts (
  id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES zora_cases(id), job_id uuid NOT NULL REFERENCES zora_jobs(id),
  filename text NOT NULL, mime_type text NOT NULL, visibility text NOT NULL CHECK(visibility IN ('client','internal')),
  data bytea NOT NULL, sha256 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zora_inbox (
  id uuid PRIMARY KEY, mailbox text NOT NULL, message_id text NOT NULL,
  subject text NOT NULL, sender text NOT NULL, body_text text NOT NULL,
  received_at timestamptz NOT NULL, case_id uuid REFERENCES zora_cases(id),
  attachment_notice text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(mailbox,message_id)
);
CREATE TABLE IF NOT EXISTS zora_mail_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, mailbox text NOT NULL,
  kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);

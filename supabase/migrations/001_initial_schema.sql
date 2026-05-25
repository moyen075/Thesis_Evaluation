CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('ADMIN', 'TEACHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_agent AS ENUM ('GEMINI', 'LLAMA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE factor_key AS ENUM (
    'content_relevance',
    'organization_cohesion',
    'lexis_academic_register',
    'grammar_mechanics'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'NOT_STARTED',
    'PHASE_1_COMPLETE',
    'PHASE_2_COMPLETE',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paragraphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paragraph_id TEXT NOT NULL UNIQUE,
  paragraph_text TEXT NOT NULL,
  legacy_initial_score NUMERIC(5,2),
  raw_yaml JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paragraph_id UUID NOT NULL REFERENCES paragraphs(id) ON DELETE CASCADE,
  agent ai_agent NOT NULL,
  total_score NUMERIC(5,2) NOT NULL CHECK (total_score >= 0 AND total_score <= 10),
  raw_feedback TEXT NOT NULL,
  corrective_feedback JSONB NOT NULL DEFAULT '[]',
  improvement_feedback JSONB NOT NULL DEFAULT '[]',
  parse_warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paragraph_id, agent)
);

CREATE TABLE IF NOT EXISTS ai_factor_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_evaluation_id UUID NOT NULL REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  factor_key factor_key NOT NULL,
  factor_label TEXT NOT NULL,
  score NUMERIC(4,2) NOT NULL CHECK (score >= 0),
  max_score NUMERIC(4,2) NOT NULL CHECK (max_score > 0),
  reason TEXT NOT NULL DEFAULT '',
  UNIQUE (ai_evaluation_id, factor_key)
);

CREATE TABLE IF NOT EXISTS teacher_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paragraph_id UUID NOT NULL REFERENCES paragraphs(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status task_status NOT NULL DEFAULT 'NOT_STARTED',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (paragraph_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS human_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL UNIQUE REFERENCES teacher_tasks(id) ON DELETE CASCADE,
  total_score NUMERIC(5,2) NOT NULL CHECK (total_score >= 0 AND total_score <= 10),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS human_factor_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  human_evaluation_id UUID NOT NULL REFERENCES human_evaluations(id) ON DELETE CASCADE,
  factor_key factor_key NOT NULL,
  score NUMERIC(4,2) NOT NULL CHECK (score >= 0),
  max_score NUMERIC(4,2) NOT NULL CHECK (max_score > 0),
  notes TEXT,
  UNIQUE (human_evaluation_id, factor_key)
);

CREATE TABLE IF NOT EXISTS ai_review_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES teacher_tasks(id) ON DELETE CASCADE,
  ai_evaluation_id UUID NOT NULL REFERENCES ai_evaluations(id) ON DELETE CASCADE,
  agent ai_agent NOT NULL,
  analytical_answers JSONB NOT NULL DEFAULT '{}',
  actionability_score INTEGER NOT NULL CHECK (actionability_score BETWEEN 1 AND 5),
  tone_register_score INTEGER NOT NULL CHECK (tone_register_score BETWEEN 1 AND 5),
  hallucinated_errors BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, ai_evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_paragraphs_paragraph_id ON paragraphs(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_ai_evaluations_paragraph ON ai_evaluations(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_ai_factor_scores_eval ON ai_factor_scores(ai_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_teacher ON teacher_tasks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_tasks_paragraph ON teacher_tasks(paragraph_id);
CREATE INDEX IF NOT EXISTS idx_human_factor_scores_eval ON human_factor_scores(human_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_answers_task ON ai_review_answers(task_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_paragraphs_updated_at ON paragraphs;
CREATE TRIGGER update_paragraphs_updated_at
  BEFORE UPDATE ON paragraphs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_ai_evaluations_updated_at ON ai_evaluations;
CREATE TRIGGER update_ai_evaluations_updated_at
  BEFORE UPDATE ON ai_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE paragraphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_factor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_factor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_read_all_paragraphs" ON paragraphs;
CREATE POLICY "admin_read_all_paragraphs"
  ON paragraphs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "teacher_read_assigned_paragraphs" ON paragraphs;
CREATE POLICY "teacher_read_assigned_paragraphs"
  ON paragraphs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_tasks
      WHERE teacher_tasks.paragraph_id = paragraphs.id
        AND teacher_tasks.teacher_id = auth.uid()
        AND teacher_tasks.status <> 'ARCHIVED'
    )
  );

DROP POLICY IF EXISTS "admin_read_ai" ON ai_evaluations;
CREATE POLICY "admin_read_ai"
  ON ai_evaluations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "teacher_read_ai_after_phase1" ON ai_evaluations;
CREATE POLICY "teacher_read_ai_after_phase1"
  ON ai_evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_tasks
      WHERE teacher_tasks.paragraph_id = ai_evaluations.paragraph_id
        AND teacher_tasks.teacher_id = auth.uid()
        AND teacher_tasks.status IN ('PHASE_1_COMPLETE', 'PHASE_2_COMPLETE')
    )
  );

DROP POLICY IF EXISTS "admin_read_ai_factors" ON ai_factor_scores;
CREATE POLICY "admin_read_ai_factors"
  ON ai_factor_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "teacher_read_ai_factors_after_phase1" ON ai_factor_scores;
CREATE POLICY "teacher_read_ai_factors_after_phase1"
  ON ai_factor_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM ai_evaluations
      JOIN teacher_tasks ON teacher_tasks.paragraph_id = ai_evaluations.paragraph_id
      WHERE ai_evaluations.id = ai_factor_scores.ai_evaluation_id
        AND teacher_tasks.teacher_id = auth.uid()
        AND teacher_tasks.status IN ('PHASE_1_COMPLETE', 'PHASE_2_COMPLETE')
    )
  );

DROP POLICY IF EXISTS "admin_read_tasks" ON teacher_tasks;
CREATE POLICY "admin_read_tasks"
  ON teacher_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "teacher_read_own_tasks" ON teacher_tasks;
CREATE POLICY "teacher_read_own_tasks"
  ON teacher_tasks FOR SELECT TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher_read_own_human" ON human_evaluations;
CREATE POLICY "teacher_read_own_human"
  ON human_evaluations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_tasks
      WHERE teacher_tasks.id = human_evaluations.task_id
        AND teacher_tasks.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_read_own_human_factors" ON human_factor_scores;
CREATE POLICY "teacher_read_own_human_factors"
  ON human_factor_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM human_evaluations
      JOIN teacher_tasks ON teacher_tasks.id = human_evaluations.task_id
      WHERE human_evaluations.id = human_factor_scores.human_evaluation_id
        AND teacher_tasks.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_read_own_ai_reviews" ON ai_review_answers;
CREATE POLICY "teacher_read_own_ai_reviews"
  ON ai_review_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_tasks
      WHERE teacher_tasks.id = ai_review_answers.task_id
        AND teacher_tasks.teacher_id = auth.uid()
    )
  );


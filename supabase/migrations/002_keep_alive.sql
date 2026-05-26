CREATE TABLE IF NOT EXISTS keep_alive (
  id INTEGER PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO keep_alive (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE keep_alive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "keep_alive_select_anon" ON keep_alive;
CREATE POLICY "keep_alive_select_anon"
  ON keep_alive FOR SELECT TO anon
  USING (true);

GRANT SELECT ON keep_alive TO anon;

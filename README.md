# Thesis Evaluation

Admin/teacher evaluation system for the Fake News paragraph dataset.

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase keys.
2. Run the SQL in `supabase/migrations/001_initial_schema.sql`.
3. Install dependencies with `npm install`.
4. Bootstrap the first admin:

```bash
npm run bootstrap:admin
```

5. Start the app:

```bash
npm run dev
```

## Dataset

The app imports the YAML files from `../Fake_News` by default. Admins can run the import from the dashboard, or from the command line:

```bash
npm run import:fake-news
```


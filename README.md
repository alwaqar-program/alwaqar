# منصة الوقار - قسم البنات

نظام إدارة دورة الوقار القرآنية لقسم البنات.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + React Router 7 + Tailwind CSS 3
- **Backend:** Supabase (Postgres + Auth)
- **Hosting:** Vercel

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL + anon key
npm run dev
```

Open http://localhost:5173

## Pages

- `/` — Dashboard
- `/applicants` — Applicants list (search + filters)
- `/applicants/:id` — Applicant detail
- `/students` — Placeholder
- `/settings` — Placeholder

## Deployment

Auto-deploys to Vercel on push to `main`. SPA routing handled by `vercel.json`.

Required env vars in Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

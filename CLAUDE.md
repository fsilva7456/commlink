# Commlink

## Infrastructure Setup

This project uses:

- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Hosting**: Vercel (auto-deploys from GitHub)
- **Development**: GitHub Codespaces supported

## Project Structure

```
src/
├── app/
│   └── page.tsx              # Main page (connection status)
└── lib/
    └── supabase/
        ├── client.ts         # Browser client (use in client components)
        ├── server.ts         # Server client (use in server components/actions)
        └── index.ts          # Exports
```

## Environment Variables

Required in Vercel (already configured):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

For local development, copy `.env.local.example` to `.env.local` and fill in values.

## Development Workflow

### Creating Feature Branches

Always create a feature branch for new work:

```bash
git checkout master
git pull origin master
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your code changes
2. Test locally with `npm run dev`
3. Commit with descriptive messages

### Creating Pull Requests

When your feature is complete:

```bash
git push -u origin feature/your-feature-name
gh pr create --title "Add your feature" --body "Description of changes"
```

Or use GitHub web UI to create the PR.

### Merging

1. Get PR reviewed/approved
2. Merge to master
3. Vercel auto-deploys to production

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## URLs

- **Production**: https://commlink-ew2rckdr7-fsilva7456s-projects.vercel.app
- **GitHub**: https://github.com/fsilva7456/commlink

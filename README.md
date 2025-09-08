This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

Create a `.env.local` file in the root directory with at least:

```bash
# Supabase (public anon key)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Development access code hint (optional; do NOT enable in prod)
SHOW_ACCESS_HINT=false

# Chat webhook (optional at build time; required at runtime to use /api/chat)
# N8N_WEBHOOK_URL=https://your-n8n-host/webhook/...

# Guardian chat webhook (homepage password hint chat; separate from internal chat)
# N8N_GUARDIAN_WEBHOOK_URL=https://your-n8n-host/guardian-webhook/...
```

Notes:
- The app’s API routes and client utilities consistently use `NEXT_PUBLIC_SUPABASE_*`.
- `/api/chat` reads `N8N_WEBHOOK_URL` at request time, so builds do not fail if it’s missing. Set it in production when enabling chat.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

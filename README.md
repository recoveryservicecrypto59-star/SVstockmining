# SVstockmining — virtual wallet starter

A Next.js + Supabase starter for a **virtual/demo USD wallet**. It has account registration, pending approval, admin-only approval/rejection, admin-only virtual balance credits, and a user transaction history.

**This is not a real-money financial product.** It has no deposits, withdrawals, transfers, payment processor, crypto custody, or redemption. Every screen must retain the demo/fictional-money disclosure.

## What is included

- Dark crypto-inspired dashboard with green/gold accents.
- Email/password registration and login.
- New accounts start as `pending`; pending users cannot see the approved member directory or a wallet.
- Admin-only approve/reject controls.
- Admin-only manual virtual USD credits.
- Integer-cent balances and an append-only transaction record.
- Supabase Row Level Security and guarded `SECURITY DEFINER` RPCs.

## 1. Create a Supabase project

Create a project at https://supabase.com. In **Project Settings → API**, copy the Project URL and anon/public key. Never put the service-role key in this app or browser.

In **SQL Editor**, run all of `supabase/schema.sql`.

In **Authentication → Providers → Email**, enable email/password. For a public site, configure email confirmation and your production redirect/site URLs.

## 2. Configure the app

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Set up the first administrator safely

The administrator email configured for this project is **bmoor4u@gmail.com**.

1. Register this email through the app and complete email confirmation.
2. In Supabase **Authentication → Users**, confirm that the exact email is verified and copy its user UUID.
3. In Supabase **SQL Editor**, replace `PASTE-ADMIN-USER-UUID` below with that UUID and run:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = 'PASTE-ADMIN-USER-UUID'
  and lower(email) = 'bmoor4u@gmail.com';

-- Verify that exactly one intended account has the admin role:
select id, email, raw_app_meta_data ->> 'role' as role
from auth.users
where lower(email) = 'bmoor4u@gmail.com';
```

4. Sign out and sign back in so the refreshed JWT contains the admin role.

Do not assign the admin role from user-editable metadata, a signup form, or client-side code. Do not share your Supabase service-role key.

## 4. Deploy

Deploy the project to a Next.js-compatible host such as Vercel. Add the same two public environment variables in the host's project settings, deploy, then set the production site URL and allowed redirect URLs in Supabase Authentication settings.

## Important production checklist

- Use a strong unique password and enable MFA for the admin account.
- Keep Supabase service-role keys private; this project does not need one in the browser.
- Configure email confirmation, password reset, rate limits, and abuse protection in Supabase.
- Review Supabase Auth and database logs periodically.
- Add CAPTCHA/anti-bot protection before opening public registration.
- Consider a server-side admin workflow and audit monitoring before a high-traffic launch.
- Never describe demo balances as withdrawable, invested, guaranteed, or redeemable funds.

## Known scope

This starter provides the core working app and database policies, but it is **not yet deployed or connected to a Supabase project**. You must create the Supabase project, run the SQL, configure environment variables, and deploy before other people can register. No live URL or production database has been created by generating these files.

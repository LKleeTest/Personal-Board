# LK Board

A personal task board: lists by task type, steps with progress bars, voice add, XP and streaks,
an All Tasks view with priority flags, a one-page Daily Summary report, and Bill Payments.

Open `index.html` (or serve the repo with GitHub Pages). Data is saved live to Supabase.

## Supabase

- Project: `kbvbfxbrmztyzuyvahgs`. Tables are prefixed `lk_` (see `supabase/migrations/`).
- Every table has row level security, so each signed-in user only sees their own rows.
- `index.html` uses the public **publishable** key. Never put a secret or service-role key in this repo.
- Sign in with an email link. In Supabase go to **Authentication → URL Configuration** and set the
  **Site URL** (and add it to **Redirect URLs**) to the address where this page is served.
- Once your own account exists, turn off **Allow new users to sign up** (Authentication → Sign In / Providers)
  so nobody else can create an account.
- First sign-in uploads whatever is on the device (including the sample data). Later sign-ins load from Supabase,
  and changes from other devices appear live.
- To move data from another copy of the app: Settings → Move your data → Copy my data, then Import data here.

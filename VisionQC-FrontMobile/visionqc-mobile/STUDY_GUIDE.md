# Vision QC Study Guide

This file is a quick explanation sheet for viva/demo questions.

## What the project does

Vision QC is a React Native mobile app built with Expo Router. It lets users:

- sign in with email/password or Google
- manage their profile and saved plant aliases
- upload a plant image for disease analysis
- view scan history and details
- receive reminder notifications for follow-up scans

There is also an admin side for user and scan oversight.

## Main architecture

- `app/`: screen files and navigation routes
- `lib/`: app logic, API helpers, auth, caching, env handling, scan-related services
- `hooks/`: reusable React hooks such as Google auth
- `components/`: shared UI building blocks

## How navigation works

- Expo Router maps files in `app/` to routes automatically.
- `app/_layout.tsx` declares the stack and screen titles.
- After login, the app fetches the current user and routes based on role:
  - admin -> `/admin/dashboard`
  - normal user -> `/user/dashboard`

## Authentication flow

1. User enters email/password on `app/index.tsx`.
2. `loginUser()` in `lib/auth.ts` sends credentials to the backend.
3. Backend returns a token.
4. The token is saved in AsyncStorage and memory.
5. The app calls `getCurrentUser()` in `lib/user.ts`.
6. The returned role decides which dashboard to open.

For Google login:

1. `useGoogleAuth()` gets a Google ID token.
2. The app sends that token to the backend.
3. The backend returns the app's own auth token.

## Why there is a current-user cache

`lib/current-user-cache.ts` stores:

- the latest fetched current user
- any in-flight `/users/me` request

This avoids duplicate backend calls when several screens need the same user data.

## How API requests work

`lib/api.ts` is the shared fetch wrapper.

It is responsible for:

- building the full URL from the base URL plus endpoint path
- adding headers
- adding the bearer token when needed
- applying request timeouts
- converting backend/network failures into user-friendly error messages

## How environment variables work

`lib/env.ts` centralizes all `EXPO_PUBLIC_*` values.

Important point for Android emulator:

- `10.0.2.2` is the special address the emulator uses to reach the host computer

So if the backend runs on your laptop, the emulator should call:

- `http://10.0.2.2:7126` instead of `http://localhost:7126`

## Scan upload flow

1. User picks or captures a plant image in `app/user/scan.tsx`.
2. The screen calls `createMyScan()` from `lib/user-features.ts`.
3. That function builds a `FormData` request:
   - alias
   - optional location
   - image file
4. The request is sent to `/api/v1/users/me/scans`.
5. Backend analyzes the scan and returns disease information.
6. The app displays the result and may schedule a follow-up reminder.

## Why scan requests are different from login

Login is a small JSON request and usually returns quickly.

Scan upload is heavier because it:

- uploads an image
- may trigger AI/backend analysis
- takes longer than normal CRUD requests

That is why scan requests may need a longer timeout.

## Reset password flow

1. User reaches `app/reset-password.tsx` from a reset link.
2. The route contains `email` and `token`.
3. User enters a new password twice.
4. The screen validates both fields.
5. `resetPassword()` sends the email, token, and new password to the backend.
6. On success, the app shows a message and redirects to sign in.

## Good short answers for professor questions

If asked "Why did you create `lib/api.ts`?"

Answer:
"To centralize network logic so every request uses the same base URL, auth header, timeout, and error handling."

If asked "Why cache the current user?"

Answer:
"Because many screens need the same profile, and caching avoids repeated `/users/me` calls and improves responsiveness."

If asked "Why use `FormData` for scans?"

Answer:
"Because the scan request sends both text fields and an image file in one HTTP request."

If asked "Why use `10.0.2.2`?"

Answer:
"Android emulator cannot use the host's `localhost` directly, so `10.0.2.2` is the emulator alias for the computer running the backend."

If asked "Why fetch the current user after login?"

Answer:
"The token authenticates the session, but the `/users/me` endpoint gives the actual profile and role used to route the user to the correct dashboard."

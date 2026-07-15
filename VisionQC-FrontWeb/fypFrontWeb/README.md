# Vision QC Web Frontend

Vision QC is a React web application for plant disease quality control workflows. It provides user authentication, scan diagnosis, scan history, reminders, plant aliases, profile management, and admin tooling for user management and dashboard analytics.

The app is built with Vite, React, React Router, TanStack Query, Radix UI primitives, and a .NET API backend.

## Features

- Email/password and Google authentication flows
- User dashboard for scan activity and plant health workflows
- AI-assisted plant scan diagnosis
- Scan history and saved scan details
- Reminder management with service worker support
- Plant alias management for user-specific plant names
- Profile and password management
- Admin dashboard with analytics views
- Admin user management

## Tech Stack

- React 18
- Vite 6
- React Router 7
- TanStack Query 5
- Radix UI components
- Sonner toasts

## Prerequisites

- Node.js and npm
- A running Vision QC .NET backend, or the backend repo available locally for the dev launcher
- Optional: the AI diagnosis service if you want scan diagnosis calls to work locally

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

Start the development server:

```bash
npm run dev
```

By default, the app runs at:

```text
http://localhost:3000
```

## Development Modes

The default development command starts the frontend and tries to start the backend automatically:

```bash
npm run dev
```

The launcher looks for the backend project at:

```text
../../GitHub/VisionQC-Backend
```

If your backend is somewhere else, set `BACKEND_DIR` before running the command:

```bash
$env:BACKEND_DIR="C:\path\to\VisionQC-Backend"
npm run dev
```

If the backend is already running on the configured backend port, the launcher starts only the frontend.

To run only the Vite frontend:

```bash
npm run dev:web
```

## Environment Variables

Environment variables are defined in `.env.example`.

Common API settings:

```text
VITE_API_PROXY_TARGET=https://localhost:7125
VITE_API_BASE_URL=
```

- `VITE_API_PROXY_TARGET` is used by the Vite dev proxy for `/api/*` requests.
- `VITE_API_BASE_URL` can be set when the frontend should call an API URL directly instead of using the dev proxy.

Authentication endpoints:

```text
VITE_LOGIN_ENDPOINT=/api/v1/auth/login
VITE_REGISTER_ENDPOINT=/api/v1/auth/register
VITE_GOOGLE_LOGIN_ENDPOINT=/api/v1/auth/google/login
VITE_GOOGLE_REGISTER_ENDPOINT=/api/v1/auth/google/register
```

User and admin endpoints:

```text
VITE_USERS_ENDPOINT=/api/v1/admin/users
VITE_ADMIN_STATS_OVERVIEW_ENDPOINT=/api/v1/admin/stats/overview
VITE_ADMIN_DISEASES_BY_LOCATION_ENDPOINT=/api/v1/admin/stats/diseases-by-location
VITE_CURRENT_USER_ENDPOINT=/api/v1/users/me
VITE_CURRENT_USER_PASSWORD_ENDPOINT=/api/v1/users/me/password
VITE_PLANT_ALIASES_ENDPOINT=/api/v1/users/me/plants
VITE_SCANS_ENDPOINT=/api/v1/users/me/scans
```

AI service settings:

```text
VITE_AI_API_BASE_URL=http://127.0.0.1:8000
VITE_AI_DIAGNOSE_ENDPOINT=/diagnose
VITE_AI_HEALTH_ENDPOINT=/health
```

## Available Scripts

```bash
npm run dev
```

Starts the frontend and attempts to start the local .NET backend.

```bash
npm run dev:web
```

Starts only the Vite frontend on port `3000`.

```bash
npm run build
```

Creates a production build in the `build/` directory.

## Works On Us

Automated tests were removed from this frontend. Validation is handled by the project team through manual checks, local runs, and production builds.

Before handing off changes, run:

```bash
npm run build
```

## App Routes

| Route | Page |
| --- | --- |
| `/` | Login |
| `/register` | Register |
| `/forgot-password` | Forgot password |
| `/reset-password` | Reset password |
| `/dashboard` | User dashboard |
| `/scan` | Plant scan |
| `/history` | Scan history |
| `/reminders` | Reminders |
| `/profile` | User profile |
| `/plant-aliases` | Plant aliases |
| `/admin` | Admin dashboard |
| `/admin/users` | Manage users |
| `/admin/profile` | Admin profile |

## Project Structure

```text
src/
  App.jsx                     App routing and page loading
  main.jsx                    React entry point
  lib/                        API clients, auth, cache, routes, scans, reminders
  components/
    layout/                   Shared app layout components
    pages/web/                Route-level pages
    ui/                       Reusable Radix-style UI primitives
    visionqc/                 Vision QC-specific components
  styles/                     Global styles
public/
  push-sw.js                  Push notification service worker
  brand-logo.png              Brand asset
scripts/
  dev-with-backend.mjs        Local frontend/backend dev launcher
```

## Build

Create a production build:

```bash
npm run build
```

The compiled app is written to:

```text
build/
```

## Notes

- Keep local secrets and machine-specific configuration in `.env`.
- Do not commit `.env`.
- The dev proxy accepts the backend HTTPS development certificate by setting `secure: false` in `vite.config.mjs`.
- The push reminder service worker is served from `public/push-sw.js`.

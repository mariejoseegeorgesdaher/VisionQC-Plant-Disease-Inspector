# VisionQC - Plant Disease Inspector

VisionQC is a full-stack plant quality-control platform for scanning plant images, recording diagnosis history, and helping users follow up on possible plant disease issues. The repository is organized as a portfolio-ready monorepo with a .NET backend, React web dashboard, Expo mobile app, and a local Python AI service.

The project demonstrates practical product engineering across API design, authentication, mobile/web UX, image upload workflows, local ML inference, AI-assisted explanation generation, admin tooling, and PostgreSQL persistence.

## Contributors

- Marie Josee
- Hadi Haj Ali - [Hadi-2005dev](https://github.com/Hadi-2005dev)

## Screenshots

Add your final application screenshots here before publishing the repository.

| Web Dashboard | Plant Scan | Scan History |
| --- | --- | --- |
| `docs/screenshots/web-dashboard.png` | `docs/screenshots/plant-scan.png` | `docs/screenshots/scan-history.png` |

| Mobile Scan | Mobile History | Admin Dashboard |
| --- | --- | --- |
| `docs/screenshots/mobile-scan.png` | `docs/screenshots/mobile-history.png` | `docs/screenshots/admin-dashboard.png` |

## What It Does

- Lets users register, log in, reset passwords, and optionally authenticate with Google.
- Supports role-based access for regular users and administrators.
- Allows users to upload or capture plant images for AI-assisted diagnosis.
- Stores scan history with confidence, disease, severity, guidance, and image references.
- Tracks plant aliases so users can organize scans by plant name and location.
- Provides follow-up and rescan reminder flows through web push and local mobile notifications.
- Gives users beginner-friendly care guidance, prevention notes, recommended products, and a More Info chat flow.
- Includes admin screens for user management, scan oversight, disease/location statistics, and dashboard analytics.
- Exposes a local AI pipeline that validates image quality, checks plant-likeness, runs a trained model, and asks Ollama for readable diagnosis explanations.

## Architecture

```text
React Web App             Expo Mobile App
    |                          |
    | REST / JSON / uploads    |
    v                          v
ASP.NET Core Web API  <---->  PostgreSQL
    |
    | multipart image diagnosis request
    v
FastAPI AI Service
    |
    | local inference + explanation generation
    v
PyTorch model + Ollama
```

### Main Components

- **Backend API**: ASP.NET Core 8 Web API with JWT auth, EF Core, PostgreSQL, Swagger, SMTP password reset, web push reminders, scan storage, and AI-service orchestration.
- **Web frontend**: Vite + React dashboard for authentication, scanning, history, plant aliases, reminders, profile management, and admin workflows.
- **Mobile frontend**: Expo Router + React Native client for user/admin flows, camera/gallery scanning, reminders, and profile/history features.
- **AI service**: FastAPI service that performs plant-image validation, photo-quality checks, PyTorch inference, and Ollama-powered explanation/chat responses.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Backend | .NET 8, ASP.NET Core Web API, Entity Framework Core, PostgreSQL, JWT Bearer Auth, BCrypt, Swagger |
| Web | React 18, Vite 6, React Router 7, TanStack Query, Radix UI, Sonner, Lucide React |
| Mobile | Expo SDK 54, React Native 0.81, React 19, Expo Router, TypeScript, AsyncStorage, Expo Camera, Expo Notifications |
| AI | Python, FastAPI, PyTorch, TorchVision, OpenCV, Pillow, Pydantic, Ollama |
| Integrations | Google Sign-In, SMTP email, Web Push / VAPID |

## Repository Structure

```text
.
+-- VisionQC-Backend/
|   +-- VisionQC-Backend/
|       +-- Controllers/          # Auth, user, admin, and push API controllers
|       +-- Data/                 # EF Core DbContext and diagnosis knowledge data
|       +-- DTOs/                 # Request/response contracts
|       +-- Migrations/           # EF Core PostgreSQL migrations
|       +-- Models/               # User, scan, disease, reminder, subscription entities
|       +-- Services/             # AI, scan storage, email, push, reminder services
|       +-- Settings/             # Strongly typed configuration sections
|       +-- Program.cs            # API startup and middleware
+-- VisionQC-FrontWeb/
|   +-- fypFrontWeb/
|       +-- public/               # Brand asset and push service worker
|       +-- scripts/              # Local development launcher
|       +-- src/
|           +-- components/       # Layout, route pages, UI primitives, VisionQC widgets
|           +-- lib/              # API clients, auth, scans, reminders, cache, routes
|           +-- styles/           # Global styling
|           +-- App.jsx           # Route registration
+-- VisionQC-FrontMobile/
|   +-- visionqc-mobile/
|       +-- app/                  # Expo Router screens for auth, user, and admin flows
|       +-- components/           # Shared mobile UI/screen sections
|       +-- hooks/                # Google auth and shared hooks
|       +-- lib/                  # API, auth, user, admin, scan, reminder helpers
|       +-- plugins/              # Expo config plugin for Android certificate trust
|       +-- scripts/              # Backend + Expo development helpers
+-- VisionQC-AI/
    +-- VisionQC-AI/
        +-- main.py               # FastAPI endpoints: /health, /diagnose, /chat
        +-- local_inference.py    # PyTorch model loading and image classification
        +-- photo_quality.py      # Blur, brightness, contrast, resolution checks
        +-- plant_presence.py     # Plant-like image validation
        +-- ollama_client.py      # Diagnosis explanation and More Info chat
        +-- schemas.py            # Pydantic response/request models
        +-- scripts/              # Training/evaluation scripts
        +-- models/               # Label metadata and training metrics
```

## Features By Area

### User Experience

- Email/password registration and login.
- Forgot-password and reset-password flows.
- Google login/register endpoints and client integration points.
- Profile editing and password changes.
- Plant alias management with location support.
- Scan history and detailed scan views.
- Rescan reminder support.

### Plant Diagnosis

- Image upload from web and mobile clients.
- Backend storage of uploaded scan images.
- AI-service call from the .NET API during scan creation.
- Plant-presence validation before diagnosis.
- Photo-quality scoring and retake guidance.
- Local model prediction with confidence thresholding.
- Structured diagnosis response with analysis, solution, prevention, care steps, products, and rescan recommendation.
- More Info chat endpoint for follow-up questions about a scan.

### Admin Tools

- User listing, filtering, creation, editing, deletion, activation/deactivation, and role changes.
- Admin statistics overview.
- Disease counts grouped by location.
- Admin dashboard pages in the web and mobile clients.

## Local Setup

### Prerequisites

- .NET SDK 8
- Node.js and npm
- Python 3.10+ recommended
- PostgreSQL
- Ollama running locally for AI explanations and chat
- Expo tooling through `npx expo`
- Android Studio or Xcode if running native mobile builds

### 1. Clone And Install

```bash
git clone <your-repo-url>
cd "VisionQC - Plant diseases inspector"
```

Install frontend dependencies:

```bash
cd VisionQC-FrontWeb/fypFrontWeb
npm install

cd ../../VisionQC-FrontMobile/visionqc-mobile
npm install
```

Install AI dependencies:

```bash
cd ../../VisionQC-AI/VisionQC-AI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Restore backend packages:

```bash
cd ../../VisionQC-Backend/VisionQC-Backend
dotnet restore
```

### 2. Configure Environment

Create local env files from examples where available:

```bash
cd VisionQC-FrontWeb/fypFrontWeb
copy .env.example .env

cd ../../VisionQC-FrontMobile/visionqc-mobile
copy .env.example .env
```

Backend configuration is read from `appsettings`, user secrets, or environment variables. Required areas include:

- `ConnectionStrings:DefaultConnection`
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience`
- `Authentication:Google:ClientIds`
- `Frontend:ResetPasswordUrl`
- `SmtpSettings`
- `AiPipeline:BaseUrl`
- `WebPush`

For local development, prefer .NET user secrets for sensitive values:

```bash
cd VisionQC-Backend/VisionQC-Backend
dotnet user-secrets set "Jwt:Key" "LONG_RANDOM_SECRET_AT_LEAST_32_CHARS"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5433;Database=VisionQC;Username=postgres;Password=YOUR_PASSWORD"
dotnet user-secrets set "AiPipeline:BaseUrl" "http://127.0.0.1:8000"
```

### 3. Prepare The Database

```bash
cd VisionQC-Backend/VisionQC-Backend
dotnet ef database update
```

### 4. Start The AI Service

Make sure Ollama is running and has the configured model available. The AI service defaults to Ollama at:

```text
http://localhost:11434
```

Then start FastAPI:

```bash
cd VisionQC-AI/VisionQC-AI
.venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

### 5. Start The Backend

```bash
cd VisionQC-Backend/VisionQC-Backend
dotnet run
```

Default API URLs:

```text
https://localhost:7125
http://localhost:7126
```

Swagger:

```text
https://localhost:7125/swagger
```

### 6. Start The Web App

```bash
cd VisionQC-FrontWeb/fypFrontWeb
npm run dev:web
```

Default URL:

```text
http://localhost:3000
```

### 7. Start The Mobile App

```bash
cd VisionQC-FrontMobile/visionqc-mobile
npm start
```

Useful alternatives:

```bash
npm run start:full
npm run start:full:tunnel
npm run android
npm run ios
npm run web
```

## API Overview

### Authentication

Base route: `/api/v1/auth`

- `POST /login`
- `POST /register`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /logout`
- `POST /google/login`
- `POST /google/register`

### User

Base route: `/api/v1/users`

- `GET /me`
- `PATCH /me`
- `PUT /me/password`
- `GET /me/aliases`
- `GET /me/plants`
- `POST /me/plants`
- `PUT /me/plants/{plantAliasId}`
- `DELETE /me/plants/{plantAliasId}`
- `POST /me/scans`
- `GET /me/scans`
- `GET /me/scans/{scanId}`

### Push And Reminders

Base route: `/api/v1/push`

- `GET /public-key`
- `POST /subscriptions`
- `POST /reminders/{scanId}/enable`
- `GET /reminders`

### Admin

Base route: `/api/v1/admin`

- `GET /users`
- `POST /users`
- `GET /users/{id}`
- `PUT /users/{id}`
- `DELETE /users/{id}`
- `PATCH /users/{id}/role`
- `PATCH /users/{id}/activate`
- `PATCH /users/{id}/deactivate`
- `GET /stats/overview`
- `GET /stats/diseases-by-location`

### AI Service

- `GET /health`
- `POST /diagnose`
- `POST /chat`

## Quality Checks

Backend:

```bash
cd VisionQC-Backend/VisionQC-Backend
dotnet build
```

Web:

```bash
cd VisionQC-FrontWeb/fypFrontWeb
npm run build
```

Mobile:

```bash
cd VisionQC-FrontMobile/visionqc-mobile
npm run typecheck
npm run lint
```

AI:

```bash
cd VisionQC-AI/VisionQC-AI
python -m py_compile main.py local_inference.py photo_quality.py plant_presence.py ollama_client.py schemas.py
```

## Notes For Public Use

- Do not commit real `.env` files, database credentials, SMTP passwords, JWT signing keys, Google client secrets, or VAPID private keys.
- The backend currently stores uploaded scan images under `wwwroot/uploads/scans`.
- The AI service depends on local model files and an available Ollama runtime for explanation generation.
- This project is intended as a portfolio and academic full-stack AI application, not as medical or agricultural professional advice.

## Portfolio Highlights

- Built a multi-client product with shared backend APIs for both web and mobile.
- Designed a layered backend with controllers, DTOs, EF Core models, migrations, and service abstractions.
- Integrated local image inference with a production-style API workflow.
- Added explainability and follow-up guidance through structured AI responses.
- Implemented role-based admin and user flows.
- Managed real-world app concerns: auth, password reset, push reminders, file uploads, CORS, environment configuration, and local developer scripts.

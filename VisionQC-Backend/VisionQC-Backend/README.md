# VisionQC Backend

ASP.NET Core Web API for VisionQC, a plant scan and diagnosis backend. The API handles user authentication, Google sign-in, plant aliases, image scan uploads, AI diagnosis results, scan history, admin user management, statistics, and web push reminders for recommended rescans.

## Tech Stack

- .NET 8 / ASP.NET Core Web API
- Entity Framework Core 8
- PostgreSQL via Npgsql
- JWT bearer authentication
- BCrypt password hashing
- Google identity token validation
- SMTP password reset email
- Web Push / VAPID notifications
- Swagger UI

## Project Structure

```text
Controllers/API Controllers  API endpoints for auth, users, admin, and push
Data                         EF Core DbContext and plant diagnosis knowledge data
DTOs                         Request and response models
Migrations                   EF Core database migrations
Models                       Database entities
Services                     Email, AI, scan storage, push, and reminder services
Settings                     Strongly typed appsettings sections
wwwroot/uploads/scans        Stored scan images served as static files
Program.cs                   Application startup and middleware pipeline
```

## Requirements

- .NET SDK 8
- PostgreSQL
- A running AI diagnosis service reachable from `AiPipeline:BaseUrl`
- SMTP credentials for password reset email
- VAPID keys for web push notifications
- Google OAuth client id if Google sign-in is enabled

## Configuration

The application reads configuration from `appsettings.json`, development settings, user secrets, or environment variables. Do not commit real passwords, SMTP app passwords, JWT signing keys, database credentials, or VAPID private keys.

Required configuration sections:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5433;Database=VisionQC;Username=postgres;Password=YOUR_PASSWORD"
  },
  "Jwt": {
    "Key": "LONG_RANDOM_SECRET_AT_LEAST_32_CHARS",
    "Issuer": "https://localhost:7125",
    "Audience": "https://localhost:7125"
  },
  "Authentication": {
    "Google": {
      "ClientIds": ["YOUR_GOOGLE_CLIENT_ID"]
    }
  },
  "Frontend": {
    "ResetPasswordUrl": "http://localhost:3000/reset-password"
  },
  "SmtpSettings": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "EnableSsl": true,
    "FromEmail": "no-reply@example.com",
    "FromName": "VisionQC",
    "Username": "no-reply@example.com",
    "Password": "SMTP_APP_PASSWORD"
  },
  "AiPipeline": {
    "BaseUrl": "http://127.0.0.1:8000"
  },
  "WebPush": {
    "Subject": "mailto:no-reply@example.com",
    "PublicKey": "VAPID_PUBLIC_KEY",
    "PrivateKey": "VAPID_PRIVATE_KEY"
  }
}
```

For local development, user secrets are safer than storing secrets directly in `appsettings.json`:

```powershell
dotnet user-secrets set "Jwt:Key" "LONG_RANDOM_SECRET_AT_LEAST_32_CHARS"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5433;Database=VisionQC;Username=postgres;Password=YOUR_PASSWORD"
dotnet user-secrets set "SmtpSettings:Password" "SMTP_APP_PASSWORD"
dotnet user-secrets set "WebPush:PrivateKey" "VAPID_PRIVATE_KEY"
```

## Database

Apply the existing EF Core migrations before running the API:

```powershell
dotnet ef database update
```

Create a new migration after model changes:

```powershell
dotnet ef migrations add MigrationName
dotnet ef database update
```

## Run Locally

Restore, build, and run:

```powershell
dotnet restore
dotnet build
dotnet run
```

The API listens on:

- `https://localhost:7125`
- `http://localhost:7126`
- `https://0.0.0.0:7125`
- `http://0.0.0.0:7126`

Swagger UI is available at:

```text
https://localhost:7125/swagger
```

## CORS

The configured frontend origins are:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://10.0.2.2:3000`
- `http://192.168.1.101:3000`

Update the `VisionQcFrontend` CORS policy in `Program.cs` if the frontend runs on a different host.

## Authentication

Most API routes require a JWT bearer token:

```http
Authorization: Bearer YOUR_TOKEN
```

Roles:

- `Regular`: normal authenticated user
- `Admin`: access to user management and statistics endpoints

## API Overview

### Auth

Base route: `/api/v1/auth`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/login` | Login with email and password |
| POST | `/register` | Create a regular user account |
| POST | `/forgot-password` | Send password reset email |
| POST | `/reset-password` | Reset password with token |
| POST | `/logout` | Stateless logout response |
| POST | `/google/login` | Login with Google identity token |
| POST | `/google/register` | Register with Google identity token |

### User

Base route: `/api/v1/users`

Requires `Regular` or `Admin`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update current user profile |
| PUT | `/me/password` | Change current user password |
| GET | `/me/aliases` | Get alias names |
| GET | `/me/plants` | Get plant aliases with latest scan summaries |
| POST | `/me/plants` | Create plant alias |
| PUT | `/me/plants/{plantAliasId}` | Update plant alias |
| DELETE | `/me/plants/{plantAliasId}` | Delete plant alias |
| POST | `/me/scans` | Upload scan image and run diagnosis |
| GET | `/me/scans` | Get scan history, optionally filtered by date and alias |
| GET | `/me/scans/{scanId}` | Get scan details |

`POST /me/scans` consumes `multipart/form-data` and accepts up to 10 MB.

### Push Notifications

Base route: `/api/v1/push`

Requires `Regular` or `Admin`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/public-key` | Get VAPID public key |
| POST | `/subscriptions` | Save browser push subscription |
| POST | `/reminders/{scanId}/enable` | Enable rescan reminder for a scan |
| GET | `/reminders` | List current user's reminders |

The `RescanReminderDispatcher` background service checks for due reminders and sends web push notifications.

### Admin

Base route: `/api/v1/admin`

Requires `Admin`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/users` | List users with filters and pagination |
| POST | `/users` | Create a local user account |
| GET | `/users/{id}` | Get one user |
| PUT | `/users/{id}` | Edit user profile or password |
| DELETE | `/users/{id}` | Delete a user account |
| PATCH | `/users/{id}/role` | Change user role |
| PATCH | `/users/{id}/activate` | Activate user |
| PATCH | `/users/{id}/deactivate` | Deactivate user |
| GET | `/stats/overview` | Get user and scan statistics |
| GET | `/stats/diseases-by-location` | Get disease counts grouped by location |

## AI Diagnosis Flow

1. The client uploads a scan image to `POST /api/v1/users/me/scans`.
2. The backend stores the image in `wwwroot/uploads/scans`.
3. The backend calls the configured AI pipeline service at `AiPipeline:BaseUrl`.
4. Diagnosis data is normalized with local knowledge from `Data/plant-diagnosis-knowledge.json`.
5. The scan, image path, disease, confidence, care steps, and rescan recommendation are saved to PostgreSQL.

## Useful Commands

```powershell
dotnet restore
dotnet build
dotnet run
dotnet ef database update
dotnet ef migrations add MigrationName
```

## Notes

- Uploaded files are served through ASP.NET Core static files from `wwwroot`.
- JWT tokens are stateless; logout is handled by the client deleting its stored token.
- Password reset tokens are stored as hashes and expire after 15 minutes.
- Google tokens are only used to verify Google identity. The backend still issues its own JWT for API access.
- Reminder notifications require the frontend to request notification permission, create a browser subscription, and send that subscription to the backend.

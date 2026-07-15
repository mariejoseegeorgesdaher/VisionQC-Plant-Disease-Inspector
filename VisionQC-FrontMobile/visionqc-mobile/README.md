# VisionQC Mobile

VisionQC Mobile is the Expo/React Native client for VisionQC, a plant quality-control and disease-diagnosis app. It supports regular users who scan and track plants, plus administrators who monitor users, scan activity, and disease statistics.

## Features

- Email/password authentication, password reset, and Google sign-in.
- Role-based routing for regular users and administrators.
- Plant scanning from camera or gallery uploads.
- Scan history with confidence, severity, urgency, follow-up, and re-scan details.
- Plant alias management with saved locations and latest scan summaries.
- Local re-scan reminder notifications.
- Admin dashboards for users, scan oversight, disease statistics, and scan export links.

## Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- TypeScript
- AsyncStorage for local auth/session cache
- Expo Camera, Image Picker, Notifications, and Google Sign-In

## Prerequisites

- Node.js and npm
- Expo CLI through `npx expo`
- Android Studio/Android SDK for Android development
- Xcode for iOS development on macOS
- A running VisionQC backend API

The helper scripts assume the backend lives at:

```powershell
C:\Users\Marie Josee\Documents\GitHub\VisionQC-Backend
```

To use a different backend location, set `VISIONQC_BACKEND_PATH` before starting the app.

## Setup

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your local backend and Google OAuth values.

## Environment Variables

The app reads public Expo environment variables from `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `auto` | Backend API base URL. `auto` resolves the current Expo host and uses port `7125`. |
| `EXPO_PUBLIC_AI_BASE_URL` | empty | Optional AI service base URL if used separately from the main API. |
| `EXPO_PUBLIC_LOGIN_ENDPOINT` | `/api/v1/auth/login` | Login endpoint. |
| `EXPO_PUBLIC_REGISTER_ENDPOINT` | `/api/v1/auth/register` | Registration endpoint. |
| `EXPO_PUBLIC_FORGOT_PASSWORD_ENDPOINT` | `/api/v1/auth/forgot-password` | Forgot-password endpoint. |
| `EXPO_PUBLIC_GOOGLE_AUTH_ENDPOINT` | `/api/v1/auth/google/login` | Google login endpoint. |
| `EXPO_PUBLIC_GOOGLE_REGISTER_ENDPOINT` | `/api/v1/auth/google/register` | Google registration endpoint. |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | empty | Android Google OAuth client ID. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | empty | iOS Google OAuth client ID. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | empty | Web Google OAuth client ID. |

Example:

```env
EXPO_PUBLIC_API_BASE_URL=auto
EXPO_PUBLIC_LOGIN_ENDPOINT=/api/v1/auth/login
EXPO_PUBLIC_REGISTER_ENDPOINT=/api/v1/auth/register
EXPO_PUBLIC_FORGOT_PASSWORD_ENDPOINT=/api/v1/auth/forgot-password
EXPO_PUBLIC_GOOGLE_AUTH_ENDPOINT=/api/v1/auth/google/login
EXPO_PUBLIC_GOOGLE_REGISTER_ENDPOINT=/api/v1/auth/google/register
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

## Running the App

Start only the mobile app:

```bash
npm start
```

Start the backend and Expo together on LAN:

```bash
npm run start:full
```

Start the backend and Expo through an Expo tunnel:

```bash
npm run start:full:tunnel
```

Run with a development client instead of Expo Go:

```bash
npm run start:full:devclient
```

or:

```bash
npm run start:full:tunnel:devclient
```

Run native targets:

```bash
npm run android
npm run ios
```

Run web:

```bash
npm run web
```

## Backend Connection Notes

`EXPO_PUBLIC_API_BASE_URL=auto` is the easiest development setting.

- Android emulator uses `10.0.2.2` to reach the host machine.
- Physical Android devices can use ADB reverse for backend port `7125` when available.
- LAN mode resolves the Expo development host and calls the backend on port `7125`.
- The combined start scripts launch the backend with HTTPS on `7125` and HTTP on `7126`.

If automatic resolution is not enough, set an explicit API URL:

```env
EXPO_PUBLIC_API_BASE_URL=https://192.168.1.20:7125
```

## Project Structure

```text
app/
  admin/              Admin dashboard, users, scans, settings, profile
  user/               User dashboard, scan flow, history, plants, profile
  _layout.tsx         Expo Router stack configuration
components/           Shared UI components and screen sections
constants/            Shared constants
hooks/                Shared React hooks
lib/                  API, auth, user, admin, scan, reminder, and env helpers
plugins/              Custom Expo config plugins
scripts/              Development and native-build helper scripts
assets/               App icons, splash assets, and static images
```

## Main Routes

- `/` - sign-in entry screen
- `/register` - account creation
- `/forgot-password` and `/reset-password` - password recovery
- `/user/dashboard` - regular user home
- `/user/scan` - plant scan upload/capture flow
- `/user/history` - scan history
- `/user/plants` - plant alias management
- `/user/profile` - user profile and password settings
- `/admin/dashboard` - admin home
- `/admin/users` - user management
- `/admin/scans` - scan and disease statistics
- `/admin/profile` - admin profile

## Quality Checks

Type-check:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Run the full validation command:

```bash
npm run validate
```

`validate` runs TypeScript, linting, and a web export.

## Android Notes

This project includes:

- `expo-dev-client` for custom development builds.
- A custom Android user certificate trust plugin in `plugins/with-android-user-ca-trust`.
- A postinstall script, `scripts/fix-android-cmake-stl.js`, that patches Android CMake STL configuration when needed.

If native dependencies or config plugins change, rebuild the dev client:

```bash
npm run android
```

## Build Configuration

EAS settings live in `eas.json`. The Expo app configuration lives in `app.json`, including package name, splash/icon assets, camera permissions, notification plugin setup, Google Sign-In, and typed route experiments.

## Troubleshooting

- `Network error. Check backend and URL`: confirm the backend is running and `EXPO_PUBLIC_API_BASE_URL` points to the correct host/port.
- Android emulator cannot reach `localhost`: use `auto` or `http://10.0.2.2:<port>`.
- Physical Android device cannot reach backend: use LAN mode, tunnel mode, or verify ADB reverse is active.
- Google sign-in fails: confirm the correct platform OAuth client IDs are present in `.env`.
- Camera or gallery access fails: grant permissions in the device settings and restart the app.
- Reminder notifications do not appear: confirm notification permission is enabled on the device.

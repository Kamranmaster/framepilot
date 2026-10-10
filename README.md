# FramePilot

A full-stack media management dashboard built with Next.js 16 that lets users upload videos with automatic cloud compression, generate platform-specific social media images, and browse a video library — all powered by Cloudinary's transformation pipeline.

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-7.9.1-2D3748?logo=prisma)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Media%20Storage-3448C5?logo=cloudinary)
![Clerk](https://img.shields.io/badge/Clerk-Authentication-6C47FF?logo=clerk)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [Video Upload with Cloud Compression](#video-upload-with-cloud-compression)
  - [Video Library Dashboard](#video-library-dashboard)
  - [Social Media Image Creator](#social-media-image-creator)
  - [Authentication](#authentication)
- [Application Workflow](#application-workflow)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Database Design](#database-design)
- [Authentication & Authorization](#authentication--authorization)
- [Environment Variables](#environment-variables)
- [Installation & Setup](#installation--setup)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)

---

## Overview

FramePilot is a media workspace that addresses two common pain points for content creators and developers:

1. **Video compression and management** — Upload raw video files, have them automatically compressed via Cloudinary's pipeline, and track compression savings across a library.
2. **Social media asset formatting** — Upload an image once and instantly generate correctly-sized versions for Instagram, Facebook, LinkedIn, TikTok, YouTube, and Twitter.

The application uses Next.js App Router with route groups, Clerk for authentication, Cloudinary for media storage and transformation, and a PostgreSQL database (Neon) managed through Prisma ORM v7.

---

## Key Features

### Video Upload with Cloud Compression

Users can upload video files (up to 70 MB) through a form that accepts a title, optional description, and the video file itself.

**How it works:**

1. The client validates the file size against a 70 MB limit before submitting.
2. The client requests a signed upload from `/api/sign-cloudinary-params`. The server (after a Clerk auth check) decides the folder and compression settings (`f_mp4,q_auto`) and signs them with the Cloudinary API secret, which never leaves the server.
3. The browser uploads the file **directly to Cloudinary** with that signature, showing a live progress bar. The file never passes through a Vercel function, so Vercel's 4.5 MB request body limit does not apply.
4. Cloudinary compresses the video on upload and returns its `public_id`.
5. The client sends only the metadata (`title`, `description`, `publicId`, `originalSize`) as JSON to `/api/video-upload`.
6. The API looks up the asset with the Cloudinary Admin API to get the real compressed size and duration (instead of trusting values from the browser), then creates a `Video` record in PostgreSQL via Prisma.
7. The client displays a success or failure notification.

**Relevant files:**
- `app/(app)/video-upload/page.tsx` — Upload form UI with progress bar
- `app/lib/uploadToCloudinary.ts` — Browser helper: get signature → upload directly to Cloudinary
- `app/api/sign-cloudinary-params/route.ts` — Signs upload parameters
- `app/api/video-upload/route.ts` — Verifies the uploaded asset and saves metadata

---

### Video Library Dashboard

The home page displays all uploaded videos in a responsive grid layout (1 column on mobile, 2 on tablet, 3 on desktop).

**Each video card shows:**
- **Thumbnail** — Generated from Cloudinary using `getCldImageUrl` with `crop: "fill"` and `gravity: "auto"`.
- **Hover preview** — On mouse hover, a 15-second preview clip auto-plays, generated using Cloudinary's `e_preview` transformation (`duration_15:max_seg_9:min_seg_dur_1`). Falls back to a "Preview not available" message on error.
- **Duration** — Formatted as `MM:SS`.
- **Original and compressed file size** — Displayed using `filesize.js`.
- **Compression percentage** — Calculated as `(1 - compressedSize / originalSize) * 100`.
- **Relative timestamp** — "Uploaded 2 hours ago" via `dayjs` with the `relativeTime` plugin.
- **Download button** — Triggers a download of the full-resolution video (1920×1080) from Cloudinary.

**Relevant files:**
- `app/(app)/home/page.tsx` — Video listing page
- `components/VideoCard.tsx` — Individual video card component
- `app/api/videos/route.ts` — GET endpoint returning all videos

---

### Social Media Image Creator

Users can upload an image and instantly preview it formatted for different social media platforms and post types.

**Supported platforms and dimensions:**

| Platform  | Format    | Dimensions  | Aspect Ratio |
|-----------|-----------|-------------|--------------|
| Instagram | Post      | 1080 × 1350 | 4:5          |
| Instagram | Square    | 1080 × 1080 | 1:1          |
| Instagram | Story     | 1080 × 1920 | 9:16         |
| Instagram | Reel      | 1080 × 1920 | 9:16         |
| Facebook  | Post      | 1200 × 1500 | 4:5          |
| Facebook  | Story     | 1080 × 1920 | 9:16         |
| LinkedIn  | Post      | 1080 × 1350 | 4:5          |
| LinkedIn  | Square    | 1200 × 1200 | 1:1          |
| LinkedIn  | Landscape | 1920 × 1080 | 16:9         |
| TikTok    | Video     | 1080 × 1920 | 9:16         |
| YouTube   | Video     | 1920 × 1080 | 16:9         |
| YouTube   | Shorts    | 1080 × 1920 | 9:16         |
| Twitter   | Image     | 1600 × 900  | 16:9         |

**How it works:**

1. The user uploads an image via the file input.
2. The image is uploaded directly from the browser to Cloudinary using a signature from `/api/sign-cloudinary-params` (same mechanism as video upload), which returns the `public_id`.
3. The `CldImage` component from `next-cloudinary` renders the image with the selected platform's dimensions using Cloudinary's `crop: "fill"` and `gravity: "auto"` transformations — all performed server-side by Cloudinary.
4. Users select a platform/format from a dropdown to see a live preview.
5. The download button fetches the transformed image as a blob and triggers a browser download with a filename like `instagram-post.png`.

**Relevant files:**
- `app/(app)/social-share/page.tsx` — Social share page
- `app/lib/uploadToCloudinary.ts` — Shared direct-upload helper

---

### Authentication

The application uses Clerk for authentication with a split-panel sign-in/sign-up UI. The sign-in page shows a marketing panel on the left describing the app's capabilities, while the Clerk `<SignIn>` component occupies the right. The sign-up page mirrors this layout in reverse.

After successful authentication, users are redirected to `/home`.

---

## Application Workflow

### Video Upload Flow

```
User fills form (title, description, file)
  → Client validates file size (≤ 70 MB)
  → GET /api/sign-cloudinary-params?type=video
      → Clerk auth check
      → Server signs { timestamp, folder, transformation } with API secret
  → Browser POSTs file directly to api.cloudinary.com (progress bar)
      → Cloudinary compresses (f_mp4, q_auto) and returns public_id
  → POST /api/video-upload (JSON: title, description, publicId, originalSize)
      → Clerk auth check
      → Cloudinary Admin API lookup → real bytes + duration
      → Prisma creates Video record in PostgreSQL
  → Response: { publicId, videoId }
  → Client shows success notification
```

### Social Image Flow

```
User selects image file
  → GET /api/sign-cloudinary-params?type=image (Clerk auth check)
  → Browser POSTs file directly to api.cloudinary.com
  → Cloudinary returns public_id
  → Client renders CldImage with selected platform dimensions
  → User selects format from dropdown → CldImage re-renders
  → Download button fetches transformed image blob
```

### Authentication Flow

```
User visits any protected route
  → Clerk middleware checks userId
  → No userId → redirect to /sign-in
  → User authenticates via Clerk (email/password or social)
  → Redirect to /home
  → Session managed by ClerkProvider
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                 │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Home   │  │ Video Upload │  │ Social Share │  │
│  │  (list)  │  │   (form)     │  │  (transform) │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
└───────┼───────────────┼─────────────────┼───────────┘
        │               │ small JSON      │       large file
        │               │ requests only   │       (signed, direct)
        ▼               ▼                 │            │
┌─────────────────────────────────────────┼───────┐    │
│      Next.js API Routes (Vercel)        │       │    │
│                                         │       │    │
│  GET  /api/videos                       │       │    │
│  GET  /api/sign-cloudinary-params ◀─────┘       │    │
│  POST /api/video-upload (metadata only)         │    │
│                                                 │    │
│  Clerk auth · Cloudinary SDK (sign + verify)    │    │
│  Prisma Client (v7) + PrismaPg Adapter          │    │
└──────────────────┬──────────────────────────────┘    │
                   │                                   ▼
                   ▼                       ┌───────────────────────┐
         ┌────────────────────┐            │      Cloudinary       │
         │  Neon PostgreSQL   │            │ storage + compression │
         │  (Video metadata)  │            │ + CDN delivery        │
         └────────────────────┘            └───────────────────────┘
```

**Key architectural decisions:**
- **Route Groups** — `(app)` for authenticated pages with a sidebar layout, `(auth)` for sign-in/sign-up with a split-panel layout.
- **Prisma v7 with PrismaPg adapter** — Uses the new driver adapter pattern instead of the traditional Prisma engine. The database URL is configured in `prisma.config.ts`, not in the schema.
- **Signed direct-to-Cloudinary uploads** — Files go from the browser straight to Cloudinary. The server only signs the upload (choosing folder and transformations) and saves metadata. This avoids Vercel's 4.5 MB serverless request body limit, saves function execution time, and keeps the API secret on the server. See [docs/INTERVIEW_GUIDE.md](docs/INTERVIEW_GUIDE.md#the-hardest-bug-uploads-failing-only-in-production) for the full story behind this design.
- **Server-side verification** — `/api/video-upload` only accepts `publicId`s in the `video-upload/` folder and reads size/duration from Cloudinary itself, so the browser cannot submit fake numbers.
- **Client-side Clerk middleware** — Defined in `proxy.ts` using `clerkMiddleware`, protecting all routes except `/`, `/home`, `/sign-in`, `/sign-up`, and `GET /api/videos`.

---

## Technology Stack

### Core

| Technology         | Version | Purpose                                   |
|--------------------|---------|-------------------------------------------|
| Next.js            | 16.3.0  | React framework with App Router           |
| React              | 19.2.8  | UI library                                |
| TypeScript         | 5.x     | Type safety                               |
| Turbopack          | —       | Default bundler for Next.js 16            |

### Backend & Data

| Technology         | Version | Purpose                                   |
|--------------------|---------|-------------------------------------------|
| Prisma ORM         | 7.9.1   | Database ORM with type-safe queries       |
| @prisma/adapter-pg | 7.9.1   | PostgreSQL driver adapter for Prisma v7   |
| pg                 | 8.23.0  | Node.js PostgreSQL client                 |
| Neon PostgreSQL    | —       | Serverless PostgreSQL hosting             |

### Authentication

| Technology         | Version | Purpose                                   |
|--------------------|---------|-------------------------------------------|
| @clerk/nextjs      | 7.7.1   | Authentication and user management        |

### Media & Storage

| Technology         | Version | Purpose                                   |
|--------------------|---------|-------------------------------------------|
| cloudinary         | 2.10.0  | Server-side media upload and transformation|
| next-cloudinary    | 6.18.8  | CldImage/CldVideo components for Next.js  |

### Styling

| Technology         | Version | Purpose                                   |
|--------------------|---------|-------------------------------------------|
| Tailwind CSS       | 4.x     | Utility-first CSS framework               |
| daisyUI            | 5.7.16  | Component library for Tailwind CSS        |
| Inter (Google Font)| —       | Primary typeface                          |

### Utilities

| Technology         | Purpose                                         |
|--------------------|-------------------------------------------------|
| axios              | HTTP client for API calls from the frontend     |
| dayjs              | Lightweight date formatting (relative time)     |
| filesize.js        | Human-readable file size formatting             |
| lucide-react       | Icon library                                    |

### Developer Tooling

| Technology         | Purpose                                         |
|--------------------|-------------------------------------------------|
| ESLint             | Code linting (core-web-vitals + TypeScript)     |
| PostCSS            | CSS processing via @tailwindcss/postcss         |
| dotenv             | Environment variable loading for Prisma CLI     |

---

## Project Structure

```
framepilot/
├── app/
│   ├── (app)/                      # Authenticated route group
│   │   ├── layout.tsx              # Sidebar + navbar layout (client component)
│   │   ├── home/
│   │   │   └── page.tsx            # Video library grid
│   │   ├── video-upload/
│   │   │   └── page.tsx            # Video upload form
│   │   └── social-share/
│   │       └── page.tsx            # Social media image creator
│   ├── (auth)/                     # Authentication route group
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx        # Clerk sign-in with marketing panel
│   │   └── sign-up/
│   │       └── [[...sign-up]]/
│   │           └── page.tsx        # Clerk sign-up with marketing panel
│   ├── api/
│   │   ├── sign-cloudinary-params/
│   │   │   └── route.ts           # GET — sign a direct browser→Cloudinary upload
│   │   ├── video-upload/
│   │   │   └── route.ts           # POST — verify uploaded video + save metadata
│   │   └── videos/
│   │       └── route.ts           # GET — fetch all videos from database
│   ├── generated/prisma/          # Auto-generated Prisma client (gitignored)
│   ├── lib/
│   │   ├── prisma.ts              # Singleton Prisma client with PrismaPg adapter
│   │   └── uploadToCloudinary.ts  # Browser helper for signed direct uploads
│   ├── layout.tsx                 # Root layout (ClerkProvider, Inter font)
│   ├── page.tsx                   # Root redirect → /home
│   └── globals.css                # Tailwind + daisyUI imports, CSS variables
├── components/
│   └── VideoCard.tsx              # Video card with thumbnail, preview, download
├── docs/
│   └── INTERVIEW_GUIDE.md         # Project walkthrough, Q&A, and bug case study
├── prisma/
│   ├── schema.prisma              # Database schema (Video model)
│   ├── migrations/                # SQL migration history
│   └── prisma.config.ts           # Prisma v7 config (datasource URL)
├── types/
│   └── index.ts                   # Re-exported Video type from Prisma
├── proxy.ts                       # Clerk middleware (route protection)
├── next.config.ts                 # Next.js configuration
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration with path aliases
```

---

## API Documentation

All API routes are Next.js Route Handlers located under `app/api/`.

### `GET /api/videos`

Fetches all videos from the database, ordered by creation date (newest first).

| Property       | Detail                                        |
|----------------|-----------------------------------------------|
| **Auth**       | Public (no authentication required)           |
| **Response**   | `200` — Array of `Video` objects              |
| **Error**      | `500` — `{ error: "Error fetching videos" }`  |

**Response body:**
```json
[
  {
    "id": "clx...",
    "title": "Demo Video",
    "description": "A sample video",
    "publicId": "video-upload/abc123",
    "originalSize": 52428800,
    "compressedSize": "12345678",
    "duration": 127.5,
    "createdAt": "2026-08-09T03:05:21.000Z",
    "updatedAt": "2026-08-09T03:05:21.000Z"
  }
]
```

---

### `GET /api/sign-cloudinary-params?type=video|image`

Returns a signature that lets the browser upload one file directly to Cloudinary. The folder and transformation are fixed on the server, so the client cannot change them.

| Property       | Detail                                        |
|----------------|-----------------------------------------------|
| **Auth**       | Required (Clerk)                              |
| **Response**   | `200` — `{ timestamp, folder, transformation?, signature, apiKey, cloudName }` |
| **Errors**     | `401` — Unauthorized                          |
|                | `400` — Invalid upload type                   |
|                | `500` — Cloudinary is not configured          |

| `type`  | Folder                    | Transformation |
|---------|---------------------------|----------------|
| `video` | `video-upload`            | `f_mp4,q_auto` |
| `image` | `next-cloudinary-uploads` | —              |

---

### `POST /api/video-upload`

Saves a video that the browser has already uploaded to Cloudinary. The route looks the asset up in Cloudinary to get its real compressed size and duration.

| Property       | Detail                                        |
|----------------|-----------------------------------------------|
| **Auth**       | Required (Clerk)                              |
| **Content-Type** | `application/json`                          |
| **Response**   | `200` — `{ publicId, videoId }`               |
| **Errors**     | `401` — Unauthorized                          |
|                | `400` — Missing title / invalid publicId / invalid original size |
|                | `500` — Upload failed                         |

**Request body (JSON):**

| Field          | Type   | Required | Description                                  |
|----------------|--------|----------|----------------------------------------------|
| `title`        | string | Yes      | Video title                                  |
| `description`  | string | No       | Video description                            |
| `publicId`     | string | Yes      | Cloudinary public ID (must start with `video-upload/`) |
| `originalSize` | number | Yes      | Original file size in bytes                  |

---

## Database Design

**Provider:** PostgreSQL (Neon serverless)
**ORM:** Prisma v7 with `prisma-client` generator and `PrismaPg` driver adapter

### Video Model

| Column           | Type       | Constraints          | Description                          |
|------------------|------------|----------------------|--------------------------------------|
| `id`             | `String`   | `@id @default(cuid())`| Unique identifier (CUID)           |
| `title`          | `String`   | Required             | User-provided video title            |
| `description`    | `String?`  | Optional             | User-provided video description      |
| `publicId`       | `String`   | Required             | Cloudinary public ID for the asset   |
| `originalSize`   | `Float`    | Required             | Original file size in bytes          |
| `compressedSize` | `String`   | Required             | Compressed file size in bytes        |
| `duration`       | `Float`    | Required             | Video duration in seconds            |
| `createdAt`      | `DateTime` | `@default(now())`    | Record creation timestamp            |
| `updatedAt`      | `DateTime` | `@updatedAt`         | Last update timestamp                |

**Prisma Client setup (`app/lib/prisma.ts`):**
The client uses a singleton pattern with `globalThis` caching in development to prevent hot-reload connection exhaustion. The `PrismaPg` adapter connects directly via the `DATABASE_URL` connection string.

**Migration history:**
1. `20260809030521_init` — Initial schema with all fields as `TEXT`.
2. `20260809063328_float_fix` — Changed `originalSize` and `duration` from `TEXT` to `DOUBLE PRECISION`.

---

## Authentication & Authorization

### Provider

[Clerk](https://clerk.com/) handles all authentication flows including sign-up, sign-in, session management, and user profile data.

### Middleware

Route protection is implemented in `proxy.ts` using `clerkMiddleware`:

- **Public routes** (no auth required): `/`, `/home`, `/sign-in`, `/sign-up`
- **Public API routes** (no auth required): `/api/videos` (GET)
- **Protected routes**: Everything else — unauthenticated users are redirected to `/sign-in`

### API-Level Auth

The `GET /api/sign-cloudinary-params` and `POST /api/video-upload` endpoints independently verify authentication by calling `auth()` from `@clerk/nextjs/server` and return `401 Unauthorized` if no `userId` is present.

### User Interface

- The `ClerkProvider` wraps the entire application in the root layout.
- The app layout navbar displays the authenticated user's avatar and username/email.
- Sign-out is available from both the navbar icon and a sidebar button.
- After sign-out, the user is returned to the public routes.

---

## Environment Variables

| Variable                                          | Purpose                                | Required |
|---------------------------------------------------|----------------------------------------|----------|
| `DATABASE_URL`                                    | PostgreSQL connection string (Neon)    | Yes      |
| `CLOUDINARY_URL`                                  | Cloudinary API credentials             | Yes      |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`               | Cloudinary cloud name (client-side)    | Yes      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Clerk publishable key (client-side)    | Yes      |
| `CLERK_SECRET_KEY`                                | Clerk secret key (server-side)         | Yes      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | Sign-in page path                      | Yes      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | Sign-up page path                      | Yes      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Redirect after sign-in                 | Yes      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Redirect after sign-up                 | Yes      |

> **Note:** Never commit actual secrets. The `.env` and `.env.local` files are gitignored.

---

## Installation & Setup

### Prerequisites

- **Node.js** 18.x or later
- **npm** (included with Node.js)
- A **PostgreSQL** database (e.g., [Neon](https://neon.tech/))
- A **Cloudinary** account ([cloudinary.com](https://cloudinary.com/))
- A **Clerk** account ([clerk.com](https://clerk.com/))

### 1. Clone the repository

```bash
git clone https://github.com/Kamranmaster/framepilot.git
cd framepilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env` and `.env.local` files in the project root:

**`.env`**
```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

**`.env.local`**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/home
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/home
```

### 4. Set up the database

Generate the Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Run the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Available Scripts

| Command          | Description                                   |
|------------------|-----------------------------------------------|
| `npm run dev`    | Start the development server (Turbopack)      |
| `npm run build`  | Generate Prisma client + production build     |
| `npm run start`  | Start the production server                   |
| `npm run lint`   | Run ESLint                                    |

---

## Deployment

The project is configured for deployment on **Vercel**.

### Build process

The `build` script in `package.json` runs `prisma generate && next build`, ensuring the Prisma client is generated before the Next.js build. This is necessary because the `app/generated/prisma/` directory is gitignored and must be regenerated on each deployment.

### Vercel configuration

1. Connect the GitHub repository to Vercel.
2. Add all environment variables from the [Environment Variables](#environment-variables) section to the Vercel project settings.
3. The build command (`npm run build`) is automatically detected.
4. `serverExternalPackages: ["@prisma/adapter-pg"]` is configured in `next.config.ts` to ensure the PostgreSQL adapter resolves correctly in the serverless environment.
5. Run `npx prisma migrate deploy` once against the production database so the `Video` table exists.

### Why uploads bypass Vercel

Vercel serverless functions reject request bodies larger than **4.5 MB** (`413 FUNCTION_PAYLOAD_TOO_LARGE`). Uploading a 70 MB video through an API route works on `localhost` but fails in production. FramePilot therefore uploads files directly from the browser to Cloudinary using signed parameters, and the API routes only handle small JSON requests. Details: [docs/INTERVIEW_GUIDE.md](docs/INTERVIEW_GUIDE.md#the-hardest-bug-uploads-failing-only-in-production).

---

## Known Limitations

- **No user-scoped videos** — All uploaded videos are visible to all users. There is no `userId` field on the `Video` model.
- **No video deletion** — There is no API endpoint or UI to delete uploaded videos.
- **No pagination** — The `GET /api/videos` endpoint returns all videos without pagination.
- **70 MB upload limit** — Enforced in the browser. Cloudinary's own plan limits (100 MB per video on the free plan) apply on top of that. Videos above 100 MB would need Cloudinary's chunked upload.
- **Orphaned uploads** — If the metadata request fails after a successful Cloudinary upload, the asset stays in Cloudinary without a database record.
- **No tests** — The project does not include a test suite.

---

## Author

**Kamran Ahmed** — [GitHub](https://github.com/Kamranmaster)

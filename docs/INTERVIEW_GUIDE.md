# FramePilot — Interview Guide

A walkthrough of how FramePilot is built, the design decisions behind it, and the hardest bug found while shipping it. Use it to explain the project clearly in a technical interview.

---

## Contents

- [30-second pitch](#30-second-pitch)
- [2-minute walkthrough](#2-minute-walkthrough)
- [Architecture at a glance](#architecture-at-a-glance)
- [Key design decisions (and why)](#key-design-decisions-and-why)
- [The hardest bug: uploads failing only in production](#the-hardest-bug-uploads-failing-only-in-production)
- [Other bugs found and fixed](#other-bugs-found-and-fixed)
- [Likely interview questions](#likely-interview-questions)
- [What I would improve next](#what-i-would-improve-next)

---

## 30-second pitch

> FramePilot is a full-stack media dashboard built with Next.js 16. Users sign in with Clerk and can upload videos, which Cloudinary compresses automatically. The app shows how much space each video saved. There's also a tool that takes one image and generates correctly-sized versions for Instagram, LinkedIn, YouTube and other platforms. Video metadata lives in PostgreSQL through Prisma 7, and the app is deployed on Vercel.

---

## 2-minute walkthrough

1. **Auth** — Clerk handles sign-in/sign-up. A Clerk middleware (`proxy.ts`, the Next.js 16 name for middleware) redirects signed-out users away from protected pages, and every write API route checks `auth()` again on the server.
2. **Video upload** — The browser asks my API for a *signed* upload permission, uploads the file directly to Cloudinary (with a progress bar), then sends only the metadata to my API. The API verifies the file with Cloudinary and saves a row in PostgreSQL.
3. **Video library** — The home page lists videos as cards. Each card shows a Cloudinary-generated thumbnail, plays a short auto-generated preview on hover (`e_preview`), and shows duration, original vs. compressed size, and compression percentage.
4. **Social image creator** — Upload an image once, pick a platform format from a dropdown, and Cloudinary crops it on the fly with `crop: fill` + `gravity: auto` (smart cropping that keeps the subject in frame). The user can download the result.
5. **Data layer** — Prisma 7 with the `PrismaPg` driver adapter connecting to Neon PostgreSQL, using a singleton client so dev hot-reloads don't exhaust connections.

---

## Architecture at a glance

```
Browser ──GET  /api/sign-cloudinary-params──▶ Vercel (Clerk auth, signs params with API secret)
Browser ──POST file (signed)────────────────▶ Cloudinary (stores + compresses: f_mp4, q_auto)
Browser ──POST /api/video-upload (JSON)─────▶ Vercel ──Admin API──▶ Cloudinary (real size/duration)
                                                     └──Prisma──▶ Neon PostgreSQL
Browser ──GET  /api/videos──────────────────▶ Vercel ──Prisma──▶ Neon PostgreSQL
Browser ◀──thumbnails / previews / downloads── Cloudinary CDN
```

| Layer       | Tech                                     |
|-------------|------------------------------------------|
| Framework   | Next.js 16 (App Router, route groups), React 19, TypeScript |
| Auth        | Clerk                                    |
| Media       | Cloudinary (`cloudinary` SDK on server, `next-cloudinary` on client) |
| Database    | PostgreSQL on Neon, Prisma 7 + `@prisma/adapter-pg` |
| UI          | Tailwind CSS 4 + daisyUI 5, lucide-react icons |
| Hosting     | Vercel                                   |

---

## Key design decisions (and why)

| Decision | Why | Trade-off |
|---|---|---|
| **Direct browser → Cloudinary uploads with signed params** | Vercel functions reject bodies over 4.5 MB. Large files shouldn't pass through my server anyway: it costs function time and memory and adds a second network hop. | Two round trips instead of one. A file can end up in Cloudinary without a DB row if the second request fails. |
| **Signing on the server, not unsigned upload presets** | An unsigned preset lets *anyone* who finds the cloud name upload files to my account. Signing means only signed-in users can upload, and only to the folder and with the transformation the server chooses. | One extra small API call per upload. |
| **Server re-reads size/duration from Cloudinary** | Never trust the client. The browser could send fake `bytes`/`duration`. The server calls `cloudinary.api.resource(publicId)` to get the real values. It also only accepts `publicId`s inside the `video-upload/` folder. | One Admin API call per upload (rate-limited on the free plan, fine at this scale). |
| **Compression at upload time (`f_mp4,q_auto`)** | `q_auto` lets Cloudinary pick the lowest quality that still looks the same, so the app can show real "bytes saved" numbers. | Very large videos may need async processing. |
| **Prisma singleton, no `$disconnect()` per request** | Serverless functions reuse warm instances. Reusing one client and its connection pool is faster than reconnecting on every request. | Must use a pooled DB connection string in production. |
| **Route groups `(app)` and `(auth)`** | Two completely different layouts (sidebar dashboard vs. split-panel auth) without affecting URLs. | — |

---

## The hardest bug: uploads failing only in production

> **Short version to say out loud (STAR format):**
>
> **Situation:** My video upload feature worked perfectly on localhost, but after deploying to Vercel every real video upload failed with a generic "Failed to upload video" message. Small test files still worked.
>
> **Task:** Find out why the same code behaved differently in production, and fix it without lowering the 70 MB limit.
>
> **Action:** I checked the browser's Network tab and saw the request to my upload API being rejected with HTTP 413 — "payload too large". The response came from Vercel's platform, before my code even ran. Vercel serverless functions have a hard 4.5 MB request body limit, and my design sent the whole video *through* my API route to Cloudinary. The local dev server has no such limit, so I never noticed. Raising the limit wasn't possible, so I redesigned the flow: the server now only *signs* an upload request, the browser uploads the file straight to Cloudinary, and then sends just the metadata to my API. To keep it secure, the server fixes the folder and transformation in the signature and re-checks the file's real size and duration with Cloudinary instead of trusting the browser.
>
> **Result:** Uploads up to 70 MB work in production. My serverless functions now only handle small JSON requests, so they're faster and cheaper. Users also got a real upload progress bar, which wasn't possible before because the server was a black box in the middle.

### Full write-up

#### 1. Symptom

- Locally (`npm run dev`): uploading a 30–70 MB video worked.
- On Vercel: the same upload failed. The UI only showed `Failed to upload video.` because the client `catch` block hid the real error.
- Very small files (under a few MB) still succeeded, which was the first clue that **size** mattered, not the code path.

#### 2. Original design (the root cause)

```
Browser ──(entire video as multipart/form-data)──▶ /api/video-upload (Vercel function)
                                                     │ file.arrayBuffer() → Buffer
                                                     │ cloudinary.uploader.upload_stream(buffer)
                                                     ▼
                                                  Cloudinary
```

```ts
// app/api/video-upload/route.ts (before)
const formData = await request.formData();
const file = formData.get("file") as File | null;
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);
// ...stream buffer to Cloudinary
```

The whole video had to fit in the HTTP request to a Vercel function. Vercel rejects function request bodies larger than **4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE`. The platform returns that error *before the function runs*, so:

- none of my `console.log`s ran,
- nothing showed up in my function logs,
- the client just saw a failed request.

#### 3. Why it was hard to find

- **It only happened in production.** The Next.js dev server has no 4.5 MB body limit, so local testing gave false confidence.
- **The error was swallowed.** The UI turned every failure into the same generic message.
- **My code never ran**, so adding logs to the API route showed nothing. You have to look at the HTTP status in the Network tab (or the Vercel request logs) to see the 413.
- **It looked like a Cloudinary or auth problem at first**, because those were the external services involved.

#### 4. Options I considered

| Option | Verdict |
|---|---|
| Lower the max upload to 4 MB | Rejected. That's useless for videos and defeats the purpose of the app. |
| Raise Vercel's body limit | Not possible. It's a fixed platform limit for serverless functions. |
| Split the file into chunks through my API | Possible, but complex. Every chunk still pays function time and has to be stitched together. |
| Host the API on a normal server (VPS) | Works, but gives up Vercel's simple deployment just to forward bytes. |
| **Browser uploads directly to Cloudinary with a server-generated signature** | **Chosen.** This is the pattern Cloudinary and S3 recommend. Files skip my server entirely. |

#### 5. The fix

```
1. Browser ──GET /api/sign-cloudinary-params?type=video──▶ Server
            Server checks Clerk auth, builds { timestamp, folder: "video-upload", transformation: "f_mp4,q_auto" },
            signs it with the Cloudinary API secret → returns signature + api_key + cloud_name

2. Browser ──POST file + signature──▶ https://api.cloudinary.com/v1_1/<cloud>/video/upload
            (axios onUploadProgress → progress bar)
            Cloudinary verifies the signature, stores + compresses → returns public_id

3. Browser ──POST /api/video-upload { title, description, publicId, originalSize }──▶ Server
            Server checks auth, checks publicId starts with "video-upload/",
            calls cloudinary.api.resource(publicId) for real bytes + duration,
            saves the row with Prisma
```

Files involved:

- `app/api/sign-cloudinary-params/route.ts` — new; signs upload params
- `app/lib/uploadToCloudinary.ts` — new; browser helper used by both the video and image pages
- `app/api/video-upload/route.ts` — now accepts JSON metadata and verifies with Cloudinary
- `app/(app)/video-upload/page.tsx` — uses the helper and shows upload progress
- `app/(app)/social-share/page.tsx` — same fix for image uploads
- `app/api/image-upload/route.ts` — removed (no longer needed)

#### 6. Security thinking (interviewers often ask about this)

- **The API secret never reaches the browser.** The browser only receives a signature that is valid for those exact parameters.
- **The client can't change the signed parameters.** If someone changes the folder or transformation, the signature no longer matches and Cloudinary rejects the upload.
- **Signatures expire.** Cloudinary rejects signatures with old timestamps (about 1 hour), so a leaked signature can't be reused forever.
- **Only signed-in users can get a signature** (Clerk `auth()` check).
- **The server doesn't trust the browser's numbers.** Compressed size and duration come from Cloudinary's Admin API, and `publicId` must be in the expected folder.

#### 7. What I learned

- **Test on the real platform early.** Serverless platforms have limits (body size, execution time, memory) that local dev servers don't.
- **Large files shouldn't pass through your app server.** Use signed direct uploads (Cloudinary signatures, S3 presigned URLs).
- **Don't swallow errors.** A generic message plus no server logs made a simple 413 look mysterious.
- **When the client does more work, the server should verify the result** instead of trusting it.

---

## Other bugs found and fixed

Smaller bugs from the same code review. They're good examples if asked about debugging or code quality.

| Bug | Cause | Fix |
|---|---|---|
| `console.log(user.firstName);` appeared as text in the navbar | JavaScript written as plain text inside JSX renders literally | Removed it |
| Video duration never appeared on cards | The duration was passed as a *child* of the `<Clock>` icon, and SVG icons ignore children | Rendered the text next to the icon |
| Compression showed `NaN%` / `-Infinity%` | Division by an `originalSize` of 0 | Guarded with `originalSize > 0 ? … : 0` |
| `prisma.$disconnect()` after every request | Defeats the singleton client. Concurrent requests can hit a closed connection, and every request pays the reconnect cost | Removed it and kept one shared client |
| Crash when a Clerk user had no email | `user.emailAddresses[0].emailAddress` on an empty array | `user.primaryEmailAddress?.emailAddress` |
| Missing title caused a 500 error | A `null` title reached a required DB column | Validate and return 400 |
| Home page showed "No videos" when the API failed | Error state was set but never rendered | Render an error alert |
| Styles not applied | Class typos (`w-fll`, `tbn-outline`, `aspect-videp`, `transiotion-all`) and Tailwind v3 `bg-opacity-*`, which doesn't exist in v4 | Fixed the class names and used `bg-base-100/50` |
| Lint errors: setState directly inside effects | React 19 lint rule `react-hooks/set-state-in-effect` | Moved the fetch logic inside the effect and reset the error state in the hover handler |

---

## Likely interview questions

**Why Next.js API routes instead of a separate Express backend?**
The backend is small: sign, save metadata, list videos. Keeping it in the same repo gives one deployment, shared TypeScript types (the Prisma `Video` type is used in both the UI and the API), and no CORS setup. If the backend grew (background jobs, websockets), I'd split it out.

**How does authentication work end to end?**
Clerk issues a session cookie. `proxy.ts` runs `clerkMiddleware` on every request and redirects signed-out users from protected pages. API routes call `auth()` themselves as well, so they're protected even if the middleware config changes.

**Why store `originalSize` from the client but `compressedSize` from Cloudinary?**
The original file only exists in the browser before upload. After upload, Cloudinary keeps only the compressed version, so `file.size` is the only source for the original. It's only used for display, so the risk is low. The compressed size and duration come from Cloudinary because they're the important, verifiable values.

**How would you handle files larger than 100 MB?**
Use Cloudinary's chunked upload (`upload_large` / `Content-Range` chunks, about 20 MB each) from the browser. I'd also switch heavy transformations to async (`eager_async`) with a webhook that updates the DB row when processing finishes.

**What happens if step 2 (Cloudinary upload) succeeds but step 3 (save metadata) fails?**
The file stays in Cloudinary without a DB row. Possible fixes: retry step 3 from the client, use a Cloudinary upload webhook (`notification_url`) so the server creates the row itself, or run a periodic cleanup job that deletes assets with no DB row.

**How would you make videos private per user?**
Add a `userId` column (from Clerk's `auth()`), filter `GET /api/videos` by it, and use per-user folders in the signed params, e.g. `video-upload/<userId>`.

**How do you scale the video list?**
Cursor-based pagination with Prisma (`take` + `cursor` on `createdAt`/`id`), an index on `createdAt`, and infinite scroll on the client.

**Why Prisma 7 with a driver adapter?**
Prisma 7 uses JavaScript driver adapters (`@prisma/adapter-pg`) instead of the old Rust query engine binary. That means smaller deployments and better support for serverless and edge environments.

---

## What I would improve next

- Per-user videos (`userId` column + filtering)
- Delete video (DB row + `cloudinary.uploader.destroy`)
- Pagination on `/api/videos`
- Cloudinary webhook to create the DB row server-side (fixes orphaned uploads)
- Chunked uploads for files over 100 MB
- Tests: unit tests for the signing route, a Playwright end-to-end test for the upload flow
- Show specific error messages to users instead of a generic "Failed to upload"

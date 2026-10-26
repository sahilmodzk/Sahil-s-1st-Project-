# Gather

A social space for people, ideas, and the everyday. Built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma, and Better Auth.

## Run locally

Use Node.js 24 LTS, npm, and Docker with Compose. Commands run from this repository's root.

```bash
node setup-env.cjs
npm ci
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open the application on port 3000. `db:seed` is optional and separate from migrations. It creates local sample accounts, artwork, posts, and activity. It is repeatable, preserves existing accounts/passwords and edited seed records, and refuses to run with `NODE_ENV=production`. It does not reset your database.

| Account | Email | Initial development password |
| --- | --- | --- |
| Member | demo@gather.local | GatherDemo123! |
| Administrator | admin@gather.local | GatherAdmin123! |

These are public development credentials. Never run the seed against a production database. New members can register through the application; administrator privileges are assigned by a database operator, never by sign-up input.

`docker compose down` stops PostgreSQL and preserves data. `docker compose down -v` deletes the local database volume. The development database port binds only to the local machine. Replace its example password for any shared environment.

## Features

- Email/password registration, sign-in, sign-out, password reset, and server-protected data routes.
- Profiles with editable names, usernames, avatars, and bios; follower and following lists.
- Follow/unfollow, a feed of followed accounts, Explore, and cursor pagination.
- Text and image posts, owner-only editing/deletion, comments, likes, bookmarks, and shareable post URLs.
- User and post search, persistent activity notifications, and read status.
- Blocking, post reporting, and an administrator report review/moderation interface.
- Responsive layouts, light/dark themes, accessible controls, loading and empty states, and actionable error messages.

Social interactions are stored in PostgreSQL. Updates are loaded through application requests; there is no WebSocket or push notification service. Notifications are in-app, not email or mobile push delivery.

## Configuration and email

The `.env.example` lists required settings and optional SMTP settings. Keep `.env` out of version control.

- `DATABASE_URL`: PostgreSQL connection URL; use the deployment provider's verified TLS configuration in production.
- `BETTER_AUTH_URL`: exact application origin, including its scheme and development port. Production uses HTTPS.
- `BETTER_AUTH_SECRET`: generate a strong independent random secret; keep it stable across application replicas and restarts. Rotating it can invalidate sessions.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`: password reset email delivery. Port 587 uses STARTTLS; use `SMTP_SECURE=true` for implicit TLS on port 465. Configure and verify your sender with your email provider.

Without SMTP in development, reset requests write private JSON messages containing the recipient and reset link to `.local/mail/`. Open the newest message locally and use its URL. This directory is ignored by Git and is not served by the web app. Treat reset links as credentials. Production requires a working SMTP service; development mailbox files are not a production delivery mechanism. Do not place real email secrets in chat, source files, or browser-visible environment variables.

## Data, uploads, and security

Prisma's schema and versioned SQL migrations live in `prisma/`. Apply committed migrations with `npm run db:migrate`; generate the client with `npm run db:generate`. These scripts use Prisma's actual WASM migration engine and engine-free JavaScript client generator, avoiding native downloads from `binaries.prisma.sh`. Migrations retain Prisma's standard `_prisma_migrations` history and checksum validation. The wrappers rely on version-pinned internal Prisma APIs; upgrade their Prisma dependencies together and validate both wrappers when updating. Use the npm scripts rather than substituting native Prisma CLI commands in restricted networks. The seed is a development utility, not application startup. Integration tests use uniquely named temporary users and clean up their own data; point tests at a separate database in CI.

Uploads are authenticated, size-limited image requests. The server decodes and re-encodes accepted images with Sharp, strips metadata, and stores generated WebP files in `uploads/`, served through a controlled media route. Back up this directory alongside PostgreSQL. A database backup alone does not include image files. Multiple application replicas need shared durable file storage or an object-storage integration; container-local ephemeral files are insufficient. Public post and avatar media can be retrieved by URL; blocking controls social access, not revocation of an already shared media URL. Deleted/replaced images are not automatically garbage-collected; remove orphan files through a separate retention process.

Better Auth manages password hashing and cookie sessions. Mutating social routes enforce session identity, same-origin requests, validation, rate limits, ownership, and administrator roles on the server. User content is rendered as text rather than injected HTML. Blocking removes follow relationships and filters social visibility in both directions. Rate-limit counters persist in PostgreSQL. Apply deployment-level request body limits and rate limiting as an additional boundary, especially when running behind a reverse proxy.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Database integration tests require a migrated PostgreSQL database and valid environment variables. For browser checks, leave the development server running in one terminal, then install Playwright's Chromium browser and run these commands in another:

```bash
npx playwright install chromium
npm run test:e2e
```

Browser tests use an already running server at `http://localhost:3000`; set `E2E_BASE_URL` to use another origin. Do not run tests against production data. A successful production build checks compilation; runtime database and SMTP connectivity must also be verified in the deployment environment.

## Publish on Railway

Railway can run this application, a PostgreSQL service, and a persistent upload volume in one project. Create an account at [railway.com](https://railway.com/) and check the current pricing before provisioning services; hosting may incur charges.

1. Create a **New Project**, choose **Deploy from GitHub repo**, connect your GitHub account, and select `sahilmodzk/Sahil-s-1st-Project-` on the `main` branch. Railway should use the committed `Dockerfile` and `railway.toml`. No custom build or start command is required. The first deployment may fail until its database and variables are configured; continue with the next steps.
2. In the same Railway project, add a **PostgreSQL** database service. In the application service's **Variables**, use **Add Reference** to reference the database service's `DATABASE_URL` as the application's `DATABASE_URL`. Use Railway's supplied connection settings rather than the local example credentials.
3. Generate a new authentication secret in your local terminal:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Add that value to the application service's private variables as `BETTER_AUTH_SECRET`. Also set `PORT` to `3000`. Keep the secret stable across redeployments and do not commit it or send it in chat.
4. Open the application's **Settings → Networking → Public Networking** and choose **Generate Domain**. Set the private variable `BETTER_AUTH_URL` to that complete HTTPS address, such as `https://your-app.up.railway.app`, with no path. If Railway asks for a target port, enter `3000`, matching the `PORT` variable above. The app listens on `0.0.0.0` and honors `PORT`.
5. Attach a persistent **Volume** to the application service at **`/app/uploads`** before accepting image uploads. Keep one application replica with this local-file storage design. Without the volume, uploaded images can disappear when a deployment is replaced.
6. Configure your email provider's `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` variables. Confirm your Railway plan permits outbound SMTP to that provider and verify sender configuration. Password reset requires successful SMTP delivery in production; the local development outbox is disabled there.
7. Deploy or redeploy after saving the settings. The container applies committed database migrations before starting the production server. The `/api/health` endpoint checks database connectivity for the configured deployment health check. Do not run `db:seed` on this production database.
8. Once the deployment is healthy, open the generated HTTPS domain and create your own account. The public development demo accounts are not installed in production. Verify registration, login, image upload, a social interaction, and actual password reset email delivery before sharing the address.

GitHub stores the source code; the Railway HTTPS domain is the website address to share. Adding or changing a custom domain also requires updating `BETTER_AUTH_URL` and redeploying. Keep database and upload-volume backups. This configuration prepares deployment; it does not create a Railway account, provision paid services, or verify external email delivery automatically.

## Deploy

1. Provision PostgreSQL and durable upload storage. Back up both, and test restoration.
2. Install dependencies from the lockfile, generate the Prisma client, and run the production build.
3. Set production database credentials, a strong authentication secret, the public HTTPS origin, and SMTP settings in your hosting platform's secret store. Do not expose them with a `NEXT_PUBLIC_` prefix.
4. Apply migrations once during deployment, then start the app with `npm start`. Set `NODE_ENV=production`; never run the development seed.
5. Place the app behind an HTTPS reverse proxy. Preserve the correct host/origin and configure trusted forwarded headers according to your platform and Better Auth documentation. Ensure secure cookies work on the public origin.
6. Verify registration/sign-in, password reset email delivery, image uploads, a social interaction, and admin authorization against the deployed service.

For an initial administrator, create the intended account normally, then have a trusted database operator set that user's `role` to `ADMIN`. There is no public role-elevation endpoint.

The default Docker Compose configuration runs the local database only. Hosting, SMTP credentials, production storage, domain configuration, backups, and monitoring are deployment responsibilities.

FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# Migration and generator packages are needed by the pinned Prisma WASM wrappers.
# Optional build trust bundle for managed environments; never stored in the image.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --include=dev --loglevel=info
COPY . .
# Build-time placeholders are confined to this command; supply real values at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_URL=https://build.invalid \
    BETTER_AUTH_SECRET="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")" \
    npm run build
ENV NODE_ENV=production
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "scripts/start-cloud.sh"]

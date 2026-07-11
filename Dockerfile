# ── Build stage ─────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ────────────────────────────────
FROM node:22-slim
WORKDIR /app
# better-sqlite3 is a native addon — npm install normally fetches a
# prebuilt binary, but keep a compiler toolchain available so a build still
# succeeds (by compiling from source) if that download is ever unreachable.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist dist/
COPY public/ public/
COPY internal/ internal/
COPY templates/ templates/
RUN mkdir -p data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
EXPOSE 8080
CMD ["node", "dist/index.js"]

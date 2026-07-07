# ── Build stage ─────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ────────────────────────────────
# LibreOffice provides `soffice --headless` for DOCX -> PDF conversion —
# same "install a system binary into the image" pattern as the WhatsApp
# bot's Puppeteer/Chromium dependency elsewhere in PCI's stack.
FROM node:22-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-writer fontconfig curl \
  && rm -rf /var/lib/apt/lists/*
# Best-effort: install the template's actual fonts (Libre Baskerville, Work
# Sans) so the exported PDF matches exactly rather than LibreOffice silently
# substituting a similar font. Non-fatal if GitHub is unreachable at build
# time — the PDF still generates either way.
RUN mkdir -p /usr/share/fonts/truetype/pci \
  && ( curl -fsSL -o /usr/share/fonts/truetype/pci/LibreBaskerville-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf || true ) \
  && ( curl -fsSL -o /usr/share/fonts/truetype/pci/LibreBaskerville-Bold.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville-Bold.ttf || true ) \
  && ( curl -fsSL -o /usr/share/fonts/truetype/pci/LibreBaskerville-Italic.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville-Italic.ttf || true ) \
  && ( curl -fsSL -o /usr/share/fonts/truetype/pci/WorkSans.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/worksans/WorkSans%5Bwght%5D.ttf || true ) \
  && fc-cache -f
WORKDIR /app
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
ENV SOFFICE_PATH=soffice
CMD ["node", "dist/index.js"]

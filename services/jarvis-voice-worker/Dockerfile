# Jarvis voice worker — an always-on LiveKit Agents process (connects OUT to LiveKit
# Cloud; serves no public HTTP).
FROM node:20-slim

WORKDIR /app

# @livekit/rtc-node's native (Rust/reqwest) engine verifies TLS against the SYSTEM CA store
# when ctx.connect() does its LiveKit-Cloud `/settings/regions` lookup. node:20-slim ships
# NO ca-certificates, so that HTTPS call fails with "failed to retrieve region info: error
# sending request for url" and the agent never joins the room — even though worker
# REGISTRATION succeeds, because that path uses Node's own bundled CA roots, not the system
# store. Install the trust store so the engine can complete its TLS handshake. (apt-get
# update works without certs — Debian mirrors are plain HTTP — so there is no bootstrap
# chicken-and-egg.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install EXACTLY the audited, committed lockfile — `npm ci` fails on any drift and honors
# the package-lock.json we vetted with `npm audit` (reproducible; a malicious transitive
# bump can't sneak in). Includes dev deps for the tsc build.
COPY package.json package-lock.json ./
RUN npm ci

# Pre-bake the Silero VAD + turn-detector model weights into the image so the first real turn
# never pays a cold model-download tax. The standalone `livekit-agents download-files` bin
# auto-discovers the installed @livekit/agents-plugin-* packages and fetches their model files;
# it needs neither the built app nor any runtime secrets (contacts only the plugin model CDNs,
# never Supabase/LiveKit/Deepgram/ElevenLabs). Pinning: model versions are fixed by the pinned
# plugins in package-lock.json (installed by `npm ci` above), so the weights are deterministic
# for this image. NOT masked with `|| true` — a failed/partial download MUST fail the build
# rather than silently ship a broken image. (Verified locally; the deprecated
# `node dist/agent.js download-files` form is avoided.)
RUN ./node_modules/.bin/livekit-agents download-files

# Build TypeScript -> dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production

# `start` = production worker mode (registers with LiveKit, waits for dispatch).
CMD ["node", "dist/agent.js", "start"]

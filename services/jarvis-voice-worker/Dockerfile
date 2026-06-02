# Jarvis voice worker — an always-on LiveKit Agents process (connects OUT to LiveKit
# Cloud; serves no public HTTP).
FROM node:20-slim

WORKDIR /app

# Install EXACTLY the audited, committed lockfile — `npm ci` fails on any drift and honors
# the package-lock.json we vetted with `npm audit` (reproducible; a malicious transitive
# bump can't sneak in). Includes dev deps for the tsc build.
COPY package.json package-lock.json ./
RUN npm ci

# Build TypeScript -> dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# NOTE: @livekit/agents (Silero VAD / turn-detector) can pre-download model weights to avoid
# a cold first-turn fetch. Add that step here ONCE the installed SDK's CLI subcommand is
# confirmed AND the weights can be version-pinned/checksum-verified. Do NOT mask its failure
# with `|| true/echo` — a swallowed error would ship a broken or tampered image silently.

ENV NODE_ENV=production

# `start` = production worker mode (registers with LiveKit, waits for dispatch).
CMD ["node", "dist/agent.js", "start"]

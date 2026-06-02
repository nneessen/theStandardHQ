# Jarvis voice worker — an always-on LiveKit Agents process (connects OUT to LiveKit
# Cloud; serves no public HTTP).
FROM node:20-slim

WORKDIR /app

# Install deps (incl. dev for the tsc build).
COPY package.json ./
RUN npm install

# Build TypeScript -> dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Some @livekit/agents plugins (Silero VAD, turn-detector) fetch model weights. Bake them
# into the image so the first turn doesn't pay a cold download. If your installed version
# exposes the subcommand, this caches them; harmless no-op otherwise.
RUN node dist/agent.js download-files || echo "no download-files step for this SDK version"

ENV NODE_ENV=production

# `start` = production worker mode (registers with LiveKit, waits for dispatch).
CMD ["node", "dist/agent.js", "start"]

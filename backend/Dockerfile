# Single stage: plain JavaScript, nothing to compile.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Includes the synced services/*/entities and services/*/shared copies.
# The root entities/ and shared/ are excluded by .dockerignore: the services run from their copies.
COPY . .

USER node
# Inside the container the app always listens on 3000; `make deploy` publishes it on the host as 3004.
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "server.js"]

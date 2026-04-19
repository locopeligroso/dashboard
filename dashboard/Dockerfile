FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ sqlite-dev
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# docker CLI to let Napoleon be called via `docker exec openclaw ...` through mounted docker.sock
RUN apk add --no-cache sqlite docker-cli
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
EXPOSE 3001
CMD ["npm","run","start"]

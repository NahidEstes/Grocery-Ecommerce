FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS api
COPY server ./server
COPY src/lib ./src/lib
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4100
USER node
EXPOSE 4100
CMD ["node", "--import", "tsx", "server/index.ts"]

FROM dependencies AS web-build
COPY . .
ARG API_URL=http://api:4100
# All store routes render dynamically. Demo allows offline compilation only;
# runtime merchant mode still controls failure handling and data sources.
ENV STORE_MODE=demo API_URL=$API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM dependencies AS web
COPY --from=web-build /app/.next ./.next
COPY public ./public
COPY next.config.ts tsconfig.json ./
ENV NODE_ENV=production API_URL=http://api:4100 NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]

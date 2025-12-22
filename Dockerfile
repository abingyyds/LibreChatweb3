FROM ghcr.io/danny-avila/librechat-dev:25a0ebee856fd4d3c680ba39607a76eb3685d618

COPY .env.example /app/.env.example
COPY api/package.json /app/api/package.json
COPY api/server/controllers/auth/ZkpLoginController.js /app/api/server/controllers/auth/ZkpLoginController.js
COPY api/server/routes/auth.js /app/api/server/routes/auth.js
COPY api/server/routes/config.js /app/api/server/routes/config.js
COPY api/server/services/ZkpService.js /app/api/server/services/ZkpService.js

COPY client/src/components/Auth/Login.tsx /app/client/src/components/Auth/Login.tsx
COPY client/src/components/Auth/ZkpLoginForm.tsx /app/client/src/components/Auth/ZkpLoginForm.tsx
COPY client/src/data-provider/Auth/mutations.ts /app/client/src/data-provider/Auth/mutations.ts

COPY deploy-compose.yml /app/deploy-compose.yml
COPY package-lock.json /app/package-lock.json

COPY packages/data-provider/src/api-endpoints.ts /app/packages/data-provider/src/api-endpoints.ts
COPY packages/data-provider/src/config.ts /app/packages/data-provider/src/config.ts
COPY packages/data-provider/src/data-service.ts /app/packages/data-provider/src/data-service.ts
COPY packages/data-provider/src/keys.ts /app/packages/data-provider/src/keys.ts
COPY packages/data-provider/src/types.ts /app/packages/data-provider/src/types.ts

COPY packages/data-schemas/src/schema/user.ts /app/packages/data-schemas/src/schema/user.ts
COPY packages/data-schemas/src/types/user.ts /app/packages/data-schemas/src/types/user.ts

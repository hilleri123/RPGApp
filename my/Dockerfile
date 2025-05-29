# Этап сборки
FROM node:18-alpine AS builder
RUN corepack enable
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json pnpm-lock.yaml ./

# Устанавливаем зависимости с увеличенной памятью
RUN NODE_OPTIONS=--max_old_space_size=4096 pnpm install --frozen-lockfile

# Копируем исходный код
COPY . .

# Выполняем сборку с отладкой и увеличенной памятью
RUN NODE_OPTIONS=--max_old_space_size=4096 NODE_ENV=production pnpm build

# Проверяем что BUILD_ID создался
RUN echo "Checking .next directory:" && ls -la .next/ || echo ".next not found"
RUN echo "BUILD_ID exists:" && test -f .next/BUILD_ID && echo "YES" || echo "NO"
RUN echo "BUILD_ID content:" && cat .next/BUILD_ID || echo "BUILD_ID missing"

# Этап запуска
FROM node:18-alpine AS runner
RUN corepack enable
WORKDIR /app

# Правильно устанавливаем NODE_ENV
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем результаты сборки
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.mjs ./

# Устанавливаем только production зависимости
COPY --from=builder /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

RUN chown -R nextjs:nodejs /app
# USER nextjs
USER root

EXPOSE 3000
CMD ["pnpm", "dev"]

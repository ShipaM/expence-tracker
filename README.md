# Трекер расходов

Монорепозиторий: Next.js (фронтенд) + NestJS (бэкенд) + PostgreSQL/Prisma.

## Стек

| Слой | Технология |
|---|---|
| Монорепо | npm workspaces + Turborepo 2.10 |
| Язык | TypeScript 5.9 |
| Фронтенд | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Бэкенд | NestJS 11 |
| БД / ORM | PostgreSQL 18, Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Валидация | zod 4 (общие схемы в `@repo/shared`) |

## Структура

```
apps/
  web/        Next.js 16, порт 3000
  api/        NestJS 11, порт 3001 (префикс /api)
packages/
  db/         Prisma: схема, миграции, сгенерированный клиент (@repo/db)
  shared/     Общие DTO и zod-схемы (@repo/shared)
```

## Запуск

```bash
npm install                 # установить зависимости всех воркспейсов
cp .env.example .env        # заполнить DATABASE_URL
docker compose up -d        # поднять PostgreSQL на :5433

npm run db:generate         # сгенерировать Prisma Client в packages/db/src/generated
npm run db:migrate          # применить миграции

npm run dev                 # web :3000, api :3001
```

**Про порт 5433.** Контейнер публикуется на 5433, а не на 5432: на 5432 сидит локально
установленная служба `postgresql-x64-18`. Windows при этом позволяет Docker-прокси
занять уже слушающий порт молча — контейнер рапортует `0.0.0.0:5432->5432`, но все
подключения достаются локальной службе. Ошибки не будет, просто данные пойдут не туда.

## Тесты

```bash
npm test                    # юнит-тесты (Vitest), БД не нужна
npm run test:e2e            # e2e для API (supertest) — нужен запущенный Docker
npm run test:coverage       # покрытие
```

E2E поднимают приложение Nest и бьют по HTTP реальными запросами. Работают в отдельной
БД `expence_tracker_test` (создаётся и мигрируется автоматически), таблицы чистятся между
кейсами — боевые данные не трогаются.

## Особенности Prisma 7

- Строка подключения задаётся в `packages/db/prisma.config.ts`, а **не** в блоке `datasource`.
- Используется генератор `prisma-client` (не устаревший `prisma-client-js`); клиент пишется
  в `packages/db/src/generated`, а не в `node_modules`.
- Driver adapter обязателен: клиент создаётся через `createPrismaClient()` из `@repo/db`.
- Клиент генерируется в CommonJS (`moduleFormat = "cjs"`) — этого требует NestJS.

## Скрипты

| Команда | Действие |
|---|---|
| `npm run dev` | Запустить web и api параллельно |
| `npm run build` | Собрать все воркспейсы |
| `npm run typecheck` | Проверка типов |
| `npm run lint` | Линтинг |
| `npm run db:migrate` | Миграции Prisma |
| `npm run db:studio` | Prisma Studio |

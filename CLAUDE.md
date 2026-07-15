# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Статус проекта

Каркас поднят и проверен: зависимости установлены, миграция `init` применена, CRUD
`/api/expenses` отвечает, все скрипты во всех `package.json` прогнаны и работают.
Тесты: 29 юнитов + 12 e2e, зелёные. Фронтенд — пока статичная заглушка на главной.

БД в контейнере пустая: таблицы созданы, данных нет. (Тестовые данные, которые могут
встретиться в истории, осели в локальном PostgreSQL на 5432 — см. «Порт БД».)

Если `packages/db/src/generated` отсутствует (свежий клон, `npm run clean`), типы из `@repo/db`
не резолвятся до `npm run db:generate` — это ожидаемо, а не ошибка в коде.

## Команды

Все команды запускаются из корня; оркестрация — Turborepo.

```bash
npm install                 # первый запуск: установить зависимости всех воркспейсов
cp .env.example .env        # DATABASE_URL и порты
docker compose up -d        # PostgreSQL 18 на :5433 (не 5432 — см. ниже)

npm run db:generate         # Prisma Client → packages/db/src/generated
npm run db:migrate          # prisma migrate dev в packages/db
npm run db:studio           # Prisma Studio на :5555

npm run dev                 # web :3000 + api :3001 параллельно
npm run build               # сборка всех воркспейсов
npm run typecheck           # tsc --noEmit
npm run lint
npm run clean               # удалить dist, .next, src/generated

npm test                    # юнит-тесты (Vitest), БД не нужна
npm run test:watch
npm run test:coverage       # покрытие (v8)
npm run test:e2e            # e2e для API (supertest), нужен запущенный контейнер
```

Один тест-файл или кейс — только внутри воркспейса, иначе Turbo передаст аргументы всем:

```bash
npm run test --workspace @repo/api -- src/expenses/expenses.service.spec.ts
npm run test --workspace @repo/api -- -t "бросает 404"
```

Работа с одним воркспейсом: `npm run <script> --workspace @repo/web` (также `@repo/api`,
`@repo/db`, `@repo/shared`).

## Архитектура

```
apps/web         Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui   → :3000
apps/api         NestJS 11, глобальный префикс /api                          → :3001
packages/db      Prisma 7: схема, миграции, сгенерированный клиент (@repo/db)
packages/shared  zod-схемы + DTO, общие для фронта и бэка (@repo/shared)
```

Граф зависимостей: `web → shared`, `api → db, shared`. `shared` и `db` компилируются через
`tsc` в `dist/` и подключаются как обычные npm-пакеты, поэтому в `turbo.json` задача `dev`
зависит от `^build` — без этого воркспейсы-библиотеки не будут собраны к моменту старта.

## Замороженные версии — не поднимать

Три пакета намеренно НЕ на `latest`. Обновление любого из них ломает сборку молча или почти
молча — прежде чем поднимать, прочитайте причину.

| Пакет | Стоит | В npm latest | Почему заморожен |
|---|---|---|---|
| typescript | 5.9.3 | 7.0.2 | NestJS 11 заявляет только `^5.7.3`; поддержка `emitDecoratorMetadata` в нативном tsgo не подтверждена — без неё ломается DI |
| eslint | 9.39.5 | 10.x | `eslint-config-next` тянет `eslint-plugin-react` 7.37, который под ESLint 10 падает с `contextOrFilename.getFilename is not a function` |
| Vitest transform | swc | Oxc (дефолт) | Oxc не поддерживает `emitDecoratorMetadata` — см. раздел «Тесты» |

Общий знаменатель: экосистема декораторов (Nest) отстаёт от новых компиляторов.

## Ловушки окружения

### Порт БД: 5433, а не 5432

На хосте 5432 занимает локальная служба `postgresql-x64-18`. Windows разрешает Docker-прокси
занять уже слушающий порт **молча**: контейнер рапортует `0.0.0.0:5432->5432/tcp` и выглядит
здоровым, но подключения на `localhost:5432` уходят в локальную службу, а не в него.
Поэтому контейнер публикуется на 5433. Если данные «пропадают» или таблиц нет там, где
ожидаются, — сначала проверьте, к какому порту реально подключились.

### next build и NODE_ENV

`next build` ломается, если в окружении заранее выставлен `NODE_ENV=development`: React грузит
dev-сборку, и пререндер падает с `Cannot read properties of null (reading 'useContext')` на
странице `/_global-error`. Признак — предупреждение «You are using a non-standard NODE_ENV
value» в начале лога. Лечится запуском с `NODE_ENV=production` или снятием переменной.

### Зависшие процессы на портах

`nest start --watch` переживает остановку родительской задачи и продолжает держать :3001.
Симптом коварный: `node dist/main.js` падает с `EADDRINUSE`, но curl всё равно отвечает 200 —
отвечает старый процесс. Проверяйте `netstat -ano | grep :3001` перед тем, как верить проверке.

## Prisma 7 — важные отличия от Prisma 6

Не применяйте здесь привычные паттерны Prisma 6, они сломаются:

1. **Строка подключения не в схеме.** `DATABASE_URL` задаётся в `packages/db/prisma.config.ts`
   через `env("DATABASE_URL")`; в блоке `datasource` схемы `url` отсутствует намеренно.
   `.env` лежит в корне монорепо, а prisma запускается из `packages/db`, поэтому путь к нему
   в `prisma.config.ts` задан явно — иначе `DATABASE_URL` не резолвится.
2. **Генератор `prisma-client`** (не устаревший `prisma-client-js`), поле `output` обязательно.
   Клиент генерируется в `packages/db/src/generated` и **не** попадает в `node_modules`;
   эта папка в `.gitignore` и пересоздаётся через `npm run db:generate`.
3. **Driver adapter обязателен.** `new PrismaClient()` без адаптера не стартует. Единственная
   точка создания клиента — `createPrismaClient()` в `packages/db/src/client.ts` (оборачивает
   `PrismaPg`). В Nest он доступен как `PrismaService.client` — сервис *содержит* клиент,
   а не наследует его.
4. **Граница ESM/CJS.** Prisma 7 — ESM-first, NestJS — CommonJS. Поэтому в генераторе явно
   стоят `moduleFormat = "cjs"` и `importFileExtension = "js"`. Импорты внутри `packages/db`
   пишутся с расширением `.js` (`./generated/client.js`), хотя файлы — `.ts`.

## Тесты

Vitest 4. Юнит-тесты — `*.spec.ts` рядом с кодом (`apps/api` — сервисы, `packages/shared` —
zod-схемы), БД для них не нужна. E2E — `apps/api/test/*.e2e-spec.ts`, отдельный конфиг
`vitest.config.e2e.ts`. Тестов для `web` пока нет — при добавлении компонентов понадобятся
`@testing-library/react` и `environment: "jsdom"`.

**Ключевой нюанс обоих конфигов api:** Vitest 4 трансформирует код через Oxc, который не
поддерживает `emitDecoratorMetadata` — с ним DI в Nest молча ломается. Поэтому стоит
`oxc: false` плюс плагин `unplugin-swc`. Не убирайте ни то, ни другое.

**E2E работают с реальной БД.** `test/global-setup.ts` создаёт базу `expence_tracker_test`
и накатывает миграции; таблицы чистятся в `beforeEach`, файлы гоняются последовательно
(`fileParallelism: false`) — они делят одну базу. Имя тестовой БД берётся из
`TEST_DATABASE_URL`, а если его нет — выводится из `DATABASE_URL` добавлением суффикса
`_test` (`test/test-db-url.ts`). Никогда не подставляйте сюда боевую базу: `beforeEach`
вызывает `deleteMany()` по всем таблицам.

E2E повторяют конфигурацию из `main.ts` (`setGlobalPrefix("api")`) — при изменении бутстрапа
не забудьте синхронизировать и тест, иначе он проверяет не то приложение, что работает в проде.

Сервисы тестируются с мокнутым `PrismaService` (см. `expenses.service.spec.ts`): мок повторяет
структуру `{ client: { expense: {...} } }`, а `Decimal` подменяется объектом с методом `toFixed`.

## ESLint

Конфиги flat, у каждого приложения свой: `apps/web/eslint.config.mjs` импортирует готовые
массивы из `eslint-config-next/core-web-vitals` и `/typescript` (FlatCompat не нужен —
Next 16 отдаёт flat-config напрямую), `apps/api/eslint.config.mjs` собран на `typescript-eslint`.
`packages/*` линтом не покрыты.

Если после смены версий появляются странные ошибки правил, проверьте `npm ls eslint`: npm любит
оставлять в воркспейсе старую копию с пометкой `invalid`, и инкрементальный `npm install` её не
чинит. Лечится полной переустановкой (`rm -rf node_modules package-lock.json && npm install`).

## TypeScript

`apps/api/tsconfig.json` обязан сохранять `experimentalDecorators` и `emitDecoratorMetadata`
(и `isolatedModules: false`, переопределяя базовый конфиг) — иначе Nest потеряет типы
конструкторов и DI перестанет работать.

## Конвенции

- **Валидация — только zod, не class-validator.** Схемы живут в `packages/shared/src/index.ts`
  и переиспользуются обоими приложениями; в Nest применяются через `ZodValidationPipe`
  (`apps/api/src/common/zod-validation.pipe.ts`), а не через глобальный `ValidationPipe`.
  `ZodValidationPipe` вешается **на параметр** — `@Body(new ZodValidationPipe(schema))`.
  Через `@UsePipes(...)` на методе он применится ко всем аргументам, включая `userId` из query,
  и упадёт с «expected object, received string». Этот баг уже был; e2e его теперь ловят.
- **Денежные суммы — строки в API.** В БД это `Decimal(12,2)`, наружу отдаются
  как `amount.toFixed(2)`: JSON-число теряет точность на копейках. Не меняйте на `number`.
- **Аутентификации пока нет.** `userId` временно приходит query-параметром
  (`@Query("userId", ParseUUIDPipe)`). Когда появится auth, он должен браться из guard'а —
  соответствующий TODO стоит в `apps/api/src/expenses/expenses.controller.ts`.
  Изоляция пользователей уже реализована в сервисе (поиск всегда с фильтром по `userId`)
  и покрыта e2e — не сломайте её при переезде на guard.
- **Tailwind 4 без `tailwind.config.js`.** Тема и токены объявлены прямо в
  `apps/web/src/app/globals.css` (`@theme inline`, CSS-переменные). Компоненты shadcn/ui
  добавляются командой `npx shadcn@latest add <component>` в `apps/web`.

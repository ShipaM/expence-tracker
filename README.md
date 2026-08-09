# Трекер расходов

Веб-приложение для учёта личных доходов и расходов: транзакции с категориями, фильтры,
пагинация и итоги за месяц (доход, расход, баланс, разбивка по категориям). Пользователи
изолированы друг от друга — данные привязаны к аккаунту, доступ закрыт JWT.

Монорепозиторий: Next.js (фронтенд) + NestJS (бэкенд) + PostgreSQL/Prisma.

**Текущее состояние.** На бэкенде готовы авторизация, полный CRUD транзакций, категорий и
регулярных платежей, агрегация за месяц и прогноз ближайших списаний. На фронтенде есть регистрация, вход, выход и главный экран с профилем
и последними транзакциями; форм создания и редактирования транзакций пока нет — они делаются
поверх готового API.

## Стек

| Слой | Технология |
|---|---|
| Монорепо | npm workspaces + Turborepo 2.10 |
| Язык | TypeScript 5.9 |
| Фронтенд | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| Бэкенд | NestJS 11, Passport + JWT, CQRS (`@nestjs/cqrs`) |
| БД / ORM | PostgreSQL 18, Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Валидация | zod 4 (auth, общие схемы в `@repo/shared`) + class-validator (`categories`, `transactions`) |
| Документация API | OpenAPI через `@nestjs/swagger`, UI на `/api/docs` |
| Тесты | Vitest 4 (юниты), supertest (e2e для API) |

## Требования

| Что | Версия | Зачем |
|---|---|---|
| Node.js | >= 20.9.0 | указано в `engines` корневого `package.json` |
| npm | 11.13.0 | зафиксирован в `packageManager`; workspaces |
| Docker | любой актуальный | контейнер PostgreSQL 18 из `docker-compose.yml` |

Свободные порты: **3000** (web), **3001** (api), **5433** (PostgreSQL), 5555 — если
понадобится Prisma Studio.

## Быстрый старт

### 1. Установка

```bash
git clone git@github.com:ShipaM/expence-tracker.git
cd expence-tracker
npm install                 # ставит зависимости всех воркспейсов сразу
```

### 2. Переменные окружения

```bash
cp .env.example .env
```

`.env` лежит **в корне монорепо** — общий для всех воркспейсов. Значения `POSTGRES_*` —
единый источник правды: их же читает `docker-compose.yml`, а `DATABASE_URL` собирается из
них через `dotenv-expand`.

| Переменная | Назначение |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | учётные данные контейнера |
| `POSTGRES_HOST` / `POSTGRES_PORT` | хост и порт на стороне хоста (по умолчанию `localhost:5433`) |
| `DATABASE_URL` | строка подключения; собирается из `POSTGRES_*`, руками менять не нужно |
| `TEST_DATABASE_URL` | отдельная БД для e2e; без неё имя выводится из `DATABASE_URL` с суффиксом `_test` |
| `PORT` | порт бэкенда, по умолчанию 3001 |
| `CORS_ORIGIN` | источник, которому бэкенд разрешает запросы (адрес фронтенда) |
| `JWT_SECRET` | секрет подписи токенов — **обязателен** |
| `NEXT_PUBLIC_API_URL` | адрес бэкенда для фронтенда |

`JWT_SECRET` в `.env.example` — плейсхолдер, его нужно заменить: без валидного значения
`JwtStrategy` бросает ошибку прямо при старте, и `api` не поднимается вообще.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. База данных

```bash
docker compose up -d        # PostgreSQL 18 на :5433
docker compose ps           # убедиться, что контейнер healthy
```

### 4. Миграции и Prisma Client

```bash
npm run db:generate         # клиент → packages/db/src/generated
npm run db:migrate          # применить миграции
```

`packages/db/src/generated` не хранится в git. На свежем клоне (или после `npm run clean`)
типы из `@repo/db` не резолвятся, пока не выполнен `db:generate` — это ожидаемо.

Новая миграция с именем:

```bash
npm run db:migrate --workspace @repo/db -- --name add_something
```

### 5. Dev-сервер

```bash
npm run dev                 # web :3000, api :3001 параллельно
```

Turborepo сначала соберёт библиотечные воркспейсы (`@repo/shared`, `@repo/db`) — без этого
приложения не стартуют. Проверить, что всё живо:

- фронтенд — <http://localhost:3000>
- API — <http://localhost:3001/api>
- Swagger UI — <http://localhost:3001/api/docs>

**Про порт 5433.** Контейнер публикуется на 5433, а не на 5432: на 5432 сидит локально
установленная служба `postgresql-x64-18`. Windows при этом позволяет Docker-прокси
занять уже слушающий порт молча — контейнер рапортует `0.0.0.0:5432->5432`, но все
подключения достаются локальной службе. Ошибки не будет, просто данные пойдут не туда.

## Структура проекта

```
apps/
  web/                  Next.js 16, порт 3000
    src/app/            App Router: маршруты + BFF Route Handlers (/api/auth/*)
    src/views/          страницы-композиции (FSD-слой «pages»)
    src/widgets/        самостоятельные блоки (auth-status, recent-transactions, …)
    src/features/       пользовательские сценарии (auth/login, auth/register, auth/logout)
    src/entities/       бизнес-сущности (session, transaction)
    src/shared/         ui (shadcn), lib, api-клиент, config
  api/                  NestJS 11, порт 3001, глобальный префикс /api
    src/auth/           register / login / me, JWT, JwtAuthGuard, @CurrentUser()
    src/users/          хранение пользователей: repository → service → CQRS-хэндлеры
    src/transactions/   CRUD транзакций + агрегация /summary
    src/categories/     CRUD категорий
    src/payments/       регулярные платежи: шаблоны повторяющихся операций
    src/prisma/         PrismaService (глобальный модуль)
    src/common/         ZodValidationPipe
    test/               e2e (supertest, реальная БД)
packages/
  db/                   Prisma: схема, миграции, сгенерированный клиент (@repo/db)
  shared/               общие DTO и zod-схемы (@repo/shared)
```

Граф зависимостей: `web → shared`, `api → db, shared`. Фронтенд построен по Feature-Sliced
Design — импорт только «вниз» по слоям. Модуль `users` не имеет HTTP-поверхности: остальные
модули обращаются к нему через `CommandBus`/`QueryBus`.

## Основные эндпоинты

Базовый URL — `http://localhost:3001/api`. Всё, кроме регистрации и входа, требует заголовок
`Authorization: Bearer <accessToken>`; `userId` берётся из токена, а не из параметров запроса.
Интерактивная документация со схемами тел и ответов — на `/api/docs`.

### Авторизация

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/auth/register` | регистрация; возвращает токен и профиль |
| `POST` | `/auth/login` | вход; возвращает токен и профиль |
| `GET` | `/auth/me` | профиль владельца токена |

### Транзакции

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/transactions` | список с фильтрами `dateFrom`, `dateTo`, `type`, `categoryId` и пагинацией `page`, `limit` |
| `GET` | `/transactions/summary?month=&year=` | итоги за месяц: доход, расход, баланс, разбивка по категориям |
| `GET` | `/transactions/:id` | одна транзакция |
| `POST` | `/transactions` | создать |
| `PATCH` | `/transactions/:id` | частично обновить |
| `DELETE` | `/transactions/:id` | удалить (204) |

### Категории

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/categories` | все категории пользователя |
| `GET` | `/categories/:id` | одна категория |
| `POST` | `/categories` | создать (имя уникально в пределах пользователя) |
| `PATCH` | `/categories/:id` | частично обновить |
| `DELETE` | `/categories/:id` | удалить (204) |

### Регулярные платежи

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/payments` | список с фильтрами `isActive`, `categoryId`, `dueBefore` |
| `GET` | `/payments/upcoming?days=30` | что спишется в ближайшие N дней, с итогами по типам |
| `GET` | `/payments/:id` | один платёж |
| `POST` | `/payments` | создать шаблон повторяющейся операции |
| `PATCH` | `/payments/:id` | частично обновить |
| `POST` | `/payments/:id/pay` | отметить оплаченным: создаёт транзакцию и сдвигает дату |
| `DELETE` | `/payments/:id` | удалить (204) |

Денежные суммы ходят через API **строками** (`"1234.56"`): в БД это `Decimal(12,2)`, а
JSON-число теряет точность на копейках.

Фронтенд не обращается к Nest напрямую: формы шлют запрос на свои же Route Handlers
`/api/auth/{login,register,logout}` (паттерн BFF), а токен хранится в httpOnly-куке —
клиентский JavaScript его не видит.

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
| `npm run db:generate` | Сгенерировать Prisma Client |
| `npm run db:migrate` | Миграции Prisma |
| `npm run db:studio` | Prisma Studio на :5555 |
| `npm run clean` | Удалить `dist`, `.next`, `src/generated` |

Скрипт одного воркспейса — `npm run <script> --workspace @repo/<web\|api\|db\|shared>`.

Соглашения по коду, веткам и коммитам — в [CLAUDE.md](CLAUDE.md); правила код-ревью —
в [REVIEW.md](REVIEW.md).

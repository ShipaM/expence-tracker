# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Статус проекта

Каркас поднят и проверен: зависимости установлены, миграции применены, CRUD
`/api/transactions` и `/api/categories` отвечают, все скрипты во всех `package.json` прогнаны и работают.
Тесты: 43 юнита (39 в `api` + 4 в `shared`) + 42 e2e (9 auth + 17 transactions + 16 categories).
Фронтенд — пока статичная заглушка на главной, авторизации на нём ещё нет:
JWT выдаётся и проверяется только на стороне API.

БД в контейнере пустая: таблицы созданы, данных нет. (Тестовые данные, которые могут
встретиться в истории, осели в локальном PostgreSQL на 5432 — см. «Порт БД».)

Если `packages/db/src/generated` отсутствует (свежий клон, `npm run clean`), типы из `@repo/db`
не резолвятся до `npm run db:generate` — это ожидаемо, а не ошибка в коде.

## Команды

Все команды запускаются из корня; оркестрация — Turborepo.

```bash
npm install                 # первый запуск: установить зависимости всех воркспейсов
cp .env.example .env        # DATABASE_URL, порты, JWT_SECRET (замените плейсхолдер — см. «Ловушки»)
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
npm run test --workspace @repo/api -- src/transactions/transactions.service.spec.ts
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

### Модули api

```
prisma/    PrismaService (клиент Prisma), глобальный
users/     хранение пользователей: repository → service → CQRS-хэндлеры. Контроллера нет
auth/      register / login / me, JWT, JwtAuthGuard, @CurrentUser()
transactions/ CRUD доходов/расходов + агрегация /summary, целиком под JwtAuthGuard;
              валидация на class-validator (см. «Конвенции»), через CQRS проверяет юзера
categories/ CRUD категорий, целиком под JwtAuthGuard; валидация на class-validator (см. «Конвенции»)
```

**Граница Users ↔ Auth — через CQRS, а не через импорт сервисов.** `AuthModule` намеренно не
импортирует `UsersModule` и не инжектит `UsersService`: общение идёт через `CommandBus`/`QueryBus`
(`@nestjs/cqrs`). Публичная поверхность модуля Users — только классы-контракты из
`apps/api/src/users/contracts/` (`CreateUserCommand`, `GetUserByEmailQuery`, `GetUserByIdQuery`);
`UsersService` и `UsersRepository` приватны для модуля. Хэндлеры видны из `AuthModule` потому,
что `CqrsModule` регистрирует их глобально — отсюда и отсутствие импорта `UsersModule`
(в `auth.module.ts` на этом стоит комментарий, не «забытый» импорт — не добавляйте его).
Так же поступают `CategoriesModule` и `TransactionsModule`: они импортируют `CqrsModule` и перед
созданием записи диспетчат `GetUserByIdQuery` через `QueryBus` (юзер мог быть удалён, пока жив
7-дневный токен); нет пользователя → `UnauthorizedException`. `UsersModule` они не импортируют.

Разделение ответственности: хэширование пароля (`bcryptjs`) и подпись JWT живут в `AuthService`,
Users лишь сохраняет готовый `passwordHash` и отдаёт записи. Уникальность email ловится в
`CreateUserHandler` по коду Prisma `P2002` → `ConflictException` (утиная проверка кода ошибки,
чтобы не завязываться на путь импорта класса ошибки Prisma).

### Фронтенд: Feature-Sliced Design (apps/web)

Фронт организован по **Feature-Sliced Design**. Слои сверху вниз, импорт — **только вниз**
(слой видит нижние, не верхние и не соседей своего уровня):

```
app       Next App Router: маршруты, layout, BFF Route Handlers (только тонкие обёртки)
views     страницы-композиции (FSD-слой «pages» переименован — «pages» занят Next)
widgets   самостоятельные блоки, собирающие фичи+сущности (напр. auth-status)
features  пользовательские сценарии (auth/login, auth/register, auth/logout)
entities  бизнес-сущности (session: getSession + SessionProvider/useSession)
shared    ui (shadcn), lib (cn), api (клиент к Nest), config — переиспользуемое, без домена
```

Слайс наружу общается через `index.ts` (публичный API); внутрь слайса — сегменты `ui/`,
`model/`, `api/`, `lib/`, `config/`. Алиас `@/*→ src/*`.

**Адаптация под App Router.** `src/app` содержит только маршруты и BFF-хендлеры и делегирует
в `views`. App-layer-обязанности (провайдеры) сведены в корневой `layout.tsx`: он серверный,
читает `getSession()` и оборачивает дерево в `SessionProvider`.

**shadcn/ui живёт в `shared/ui`.** Алиасы в `apps/web/components.json` перенастроены на
`@/shared/*` (`ui`, `lib`, `utils`), поэтому `npx shadcn@latest add <c>` кладёт компоненты сразу
туда. `globals.css` (Tailwind 4, токены в CSS) дополнен недостающими neutral-переменными
(`--input`, `--ring`, `--secondary`, `--accent`, `--popover` и их `-foreground`) — без них
компоненты рендерятся с пустыми цветами.

**Авторизация — паттерн BFF, токен в httpOnly-куке.** Клиент **никогда** не видит JWT: форма
(`features/auth/*`, react-hook-form + `zodResolver` со схемами из `@repo/shared`) шлёт запрос на
свой же Route Handler `POST /api/auth/{login,register,logout}` (same-origin). Хендлер (`proxyAuth`
в `shared/api/auth.server.ts`) ходит в Nest, получает `accessToken` и кладёт его в httpOnly-куку
`session` (`shared/config/cookie.ts`), наружу отдаёт только `{ user }`. Ошибки Nest (401/409/400)
пробрасываются со статусом и `message`; фичи маппят их на поля (409 → email) или корневую ошибку
формы (401). `getSession()` (`entities/session/server.ts`, `server-only`) читает куку и валидирует
токен запросом к Nest `/auth/me`. Залогиненного со страниц `/login` и `/register` уводит на `/`
**гард в самих серверных `page.tsx`** (`if (await getSession()) redirect("/")`), а не middleware:
результат едет вместе с RSC-prefetch, поэтому навигация гостя мгновенна, без блокирующего сетевого
вызова на каждый запрос. Проверять по одному лишь наличию куки нельзя — протухшая кука (напр. после
смены `JWT_SECRET`) иначе даёт петлю редиректов `/login → / → /login`: `getSession` её отвергает и
рисует «Войти», а presence-гард редиректит обратно. Поэтому источник истины один — `getSession`.
(Прежний `proxy.ts`/`middleware` удалён; для будущей защиты приватных маршрутов вернём отдельно.)

Граница server/client строгая: серверные модули помечены `import "server-only"` и НЕ
реэкспортируются через клиентский `index.ts` слайса (для `session` серверный вход — отдельный
`server.ts`). `shared/api/nest.ts` (`nestFetch`/`nestJson`) — тоже только сервер.

Заметка: фронтенд транзакций (страница/фичи FSD, BFF `/api/transactions`) ещё не сделан —
запланирован отдельной задачей поверх API-модуля `transactions`.

## Замороженные версии — не поднимать

Три пакета намеренно НЕ на `latest`. Обновление любого из них ломает сборку молча или почти
молча — прежде чем поднимать, прочитайте причину.

| Пакет            | Стоит  | В npm latest | Почему заморожен                                                                                                                        |
| ---------------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| typescript       | 5.9.3  | 7.0.2        | NestJS 11 заявляет только `^5.7.3`; поддержка `emitDecoratorMetadata` в нативном tsgo не подтверждена — без неё ломается DI             |
| eslint           | 9.39.5 | 10.x         | `eslint-config-next` тянет `eslint-plugin-react` 7.37, который под ESLint 10 падает с `contextOrFilename.getFilename is not a function` |
| Vitest transform | swc    | Oxc (дефолт) | Oxc не поддерживает `emitDecoratorMetadata` — см. раздел «Тесты»                                                                        |

Общий знаменатель: экосистема декораторов (Nest) отстаёт от новых компиляторов.

## Ловушки окружения

### JWT_SECRET обязателен — без него API не стартует

`JwtStrategy` требует `JWT_SECRET` и на пустом значении бросает ошибку прямо при
инициализации — то есть `npm run dev` для `api` падает на старте, а не при первом запросе.
Переменная есть и в `.env`, и в `.env.example`; после свежего `cp .env.example .env`
подставьте своё значение вместо плейсхолдера:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`.env` не отслеживается `nest start --watch` — после правки перезапустите процесс
(или троньте любой `.ts`, чтобы watch пересобрал и поднял приложение заново).

Юнит-тесты и `npm run build` этого не ловят — секрет нужен только живому приложению.
E2E тоже проходят без него: свой секрет они задают сами (см. «Тесты»).

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
   `PrismaPg`). В Nest он доступен как `PrismaService.client` — сервис _содержит_ клиент,
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

**Секрет для e2e задан в конфиге, а не в `.env`.** `vitest.config.e2e.ts` проставляет
`JWT_SECRET: "e2e-test-secret"` в `test.env`, поэтому `npm run test:e2e` работает из коробки
даже без секрета в окружении. Токены в тестах не подделываются руками — они получаются
настоящей регистрацией через `POST /api/auth/register` и передаются как `Authorization: Bearer`.

Сервисы тестируются с мокнутым `PrismaService` (см. `transactions.service.spec.ts`): мок повторяет
структуру `{ client: { transaction: {...}, category: {...} } }`, а денежные суммы задаются реальным
`Prisma.Decimal` (у него есть `toFixed`/`minus`, нужные для сериализации и расчёта `balance`).
`AuthService` тестируется тем же приёмом, но мокаются `CommandBus`/`QueryBus`/`JwtService`
(`auth.service.spec.ts`) — до Prisma тест не доходит, проверяется, что в шину ушла нужная
команда и что хэш пароля не утекает в ответ.

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

- **Валидация — zod по умолчанию.** Схемы живут в `packages/shared/src/index.ts`
  и переиспользуются обоими приложениями; в Nest применяются через `ZodValidationPipe`
  (`apps/api/src/common/zod-validation.pipe.ts`), а не через глобальный `ValidationPipe`.
  `ZodValidationPipe` вешается **на параметр** — `@Body(new ZodValidationPipe(schema))`.
  Через `@UsePipes(...)` на методе он применится ко всем аргументам, включая `userId` из query,
  и упадёт с «expected object, received string». Этот баг уже был; e2e его теперь ловят.
  **Исключение — модули `categories` и `transactions`:** по явному решению они валидируются через
  **class-validator** (DTO-классы в `apps/api/src/{categories,transactions}/dto/`) и глобальный
  `ValidationPipe`, включённый в `main.ts` (`whitelist`, `forbidNonWhitelisted`, `transform`).
  Глобальный пайп не ломает zod-контроллеры (auth): их `@Body`-типы — это `z.infer`-алиасы, в
  рантайме метатип `Object`, и `ValidationPipe` их пропускает. e2e этих модулей бутстрапят тот же
  `ValidationPipe`, иначе тестируется не то приложение, что в проде. Для новых модулей по-прежнему
  предпочитайте zod — class-validator здесь осознанное отступление, а не новый стандарт.
- **Денежные суммы — строки в API.** В БД это `Decimal(12,2)`, наружу отдаются
  как `amount.toFixed(2)`: JSON-число теряет точность на копейках. Не меняйте на `number`.
- **userId берётся из токена, а не из query.** Все эндпоинты `/api/transactions` закрыты
  `@UseGuards(JwtAuthGuard)` на уровне контроллера, `userId` приходит через `@CurrentUser()`
  (декоратор достаёт `request.user.userId`, который проставил `JwtStrategy.validate`).
  Query-параметры (`dateFrom/dateTo/type/categoryId`, `month/year`) — только фильтры, не userId.
  Не возвращайте `?userId=`: это позволяло бы читать чужие транзакции.
  `ParseUUIDPipe` остаётся только для `:id` в пути. Изоляция пользователей держится на фильтре
  по `userId` в сервисе и покрыта e2e — не сломайте её.
- **Новый защищённый контроллер = `@UseGuards(JwtAuthGuard)` + импорт `AuthModule`.**
  Guard экспортируется из `AuthModule` (`exports: [JwtAuthGuard]`), поэтому модуль-потребитель
  обязан его импортировать — так сделано в `transactions.module.ts`. Глобального guard'а нет:
  `/api/auth/register` и `/api/auth/login` должны оставаться публичными.
- **Пароль — максимум 72 символа.** Ограничение в `registerSchema` не декоративное: bcrypt
  молча обрезает всё после 72 байт, поэтому длинные пароли принимать нельзя. Хэш никогда не
  покидает бэкенд — наружу отдаётся `UserDto { id, email, name }`, собранный в
  `AuthService.toUserDto`.
- **Tailwind 4 без `tailwind.config.js`.** Тема и токены объявлены прямо в
  `apps/web/src/app/globals.css` (`@theme inline`, CSS-переменные). Компоненты shadcn/ui
  добавляются командой `npx shadcn@latest add <component>` в `apps/web`.

  ## Соглашение о коммитах

  Используй Conventional Commits:

- Тип: feat, fix, docs, refactor, test, ci
- Область (scope): модуль или область изменений
- Описание на английском, кратко
- Breaking changes помечай восклицательным знаком

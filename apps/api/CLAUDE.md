# CLAUDE.md — apps/api

Указания для Claude Code при работе с бэкендом (`@repo/api`). Здесь только бэкенд.
Общее для монорепо (корневые команды, Prisma/`packages/db`, политика версий, коммиты) —
в корневом `CLAUDE.md`. Фронтенд — в `apps/web/CLAUDE.md`.

## Что это

NestJS 11, глобальный префикс `/api`, порт `:3001`. Зависит от `@repo/db` и `@repo/shared`.

```
prisma/    PrismaService (клиент Prisma), глобальный
users/     хранение пользователей: repository → service → CQRS-хэндлеры. Контроллера нет
auth/      register / login / me, JWT, JwtAuthGuard, @CurrentUser()
transactions/ CRUD доходов/расходов + агрегация /summary, целиком под JwtAuthGuard;
              валидация на class-validator (см. «Конвенции»), через CQRS проверяет юзера
categories/ CRUD категорий, целиком под JwtAuthGuard; валидация на class-validator (см. «Конвенции»)
```

Состояние: CRUD `/api/transactions` и `/api/categories` работают, авторизация закрыта JWT.

## Команды

Только бэкенд (из корня, через воркспейс). Перед первым запуском нужны поднятый контейнер БД
и `npm run db:generate` — см. корневой `CLAUDE.md`.

```bash
npm run dev --workspace @repo/api        # nest start --watch на :3001
npm run build --workspace @repo/api      # nest build → dist
npm run start --workspace @repo/api      # node dist/main.js (после build)
npm run lint --workspace @repo/api
npm run typecheck --workspace @repo/api
npm run clean --workspace @repo/api      # удалить dist

npm run test --workspace @repo/api       # юниты (Vitest), БД не нужна
npm run test:watch --workspace @repo/api
npm run test:coverage --workspace @repo/api
npm run test:e2e --workspace @repo/api   # supertest + реальная БД, нужен контейнер
```

Один тест-файл или кейс — только внутри воркспейса, иначе Turbo передаст аргументы всем:

```bash
npm run test --workspace @repo/api -- src/transactions/transactions.service.spec.ts
npm run test --workspace @repo/api -- -t "бросает 404"
```

`PrismaService` в Nest — сервис _содержит_ клиент (`PrismaService.client`), а не наследует его:
`createPrismaClient()` из `@repo/db` возвращает клиент с driver adapter.

## Граница Users ↔ Auth — через CQRS, а не через импорт сервисов

`AuthModule` намеренно не импортирует `UsersModule` и не инжектит `UsersService`: общение идёт
через `CommandBus`/`QueryBus` (`@nestjs/cqrs`). Публичная поверхность модуля Users — только
классы-контракты из `apps/api/src/users/contracts/` (`CreateUserCommand`, `GetUserByEmailQuery`,
`GetUserByIdQuery`); `UsersService` и `UsersRepository` приватны для модуля. Хэндлеры видны из
`AuthModule` потому, что `CqrsModule` регистрирует их глобально — отсюда и отсутствие импорта
`UsersModule` (в `auth.module.ts` на этом стоит комментарий, не «забытый» импорт — не добавляйте
его).

Так же поступают `CategoriesModule` и `TransactionsModule`: они импортируют `CqrsModule` и перед
созданием записи диспетчат `GetUserByIdQuery` через `QueryBus` (юзер мог быть удалён, пока жив
7-дневный токен); нет пользователя → `UnauthorizedException`. `UsersModule` они не импортируют.

Разделение ответственности: хэширование пароля (`bcryptjs`) и подпись JWT живут в `AuthService`,
Users лишь сохраняет готовый `passwordHash` и отдаёт записи. Уникальность email ловится в
`CreateUserHandler` по коду Prisma `P2002` → `ConflictException` (утиная проверка кода ошибки,
чтобы не завязываться на путь импорта класса ошибки Prisma).

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
- **Денежные суммы — строки в ответах API.** В БД это `Decimal(12,2)`, наружу отдаются
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

## JWT_SECRET обязателен — без него API не стартует

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

## Зависшие процессы на :3001

`nest start --watch` переживает остановку родительской задачи и продолжает держать :3001.
Симптом коварный: `node dist/main.js` падает с `EADDRINUSE`, но curl всё равно отвечает 200 —
отвечает старый процесс. Проверяйте `netstat -ano | grep :3001` перед тем, как верить проверке.

## Тесты

Vitest 4. Юнит-тесты — `*.spec.ts` рядом с кодом (сервисы), БД для них не нужна.
E2E — `apps/api/test/*.e2e-spec.ts`, отдельный конфиг `vitest.config.e2e.ts`.
Сейчас: 39 юнитов + 42 e2e (9 auth + 17 transactions + 16 categories).

**Ключевой нюанс обоих конфигов:** Vitest 4 трансформирует код через Oxc, который не
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

## TypeScript

`apps/api/tsconfig.json` обязан сохранять `experimentalDecorators` и `emitDecoratorMetadata`
(и `isolatedModules: false`, переопределяя базовый конфиг) — иначе Nest потеряет типы
конструкторов и DI перестанет работать. По той же причине TypeScript в монорепо заморожен
на 5.9 (см. корневой `CLAUDE.md`): NestJS 11 заявляет только `^5.7.3`, а поддержка
`emitDecoratorMetadata` в нативном компиляторе не подтверждена.

## ESLint

`apps/api/eslint.config.mjs` — flat-конфиг, собран на `typescript-eslint`.

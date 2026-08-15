# Авторизация в API: модули Users, Auth (JWT) через CQRS

## Context

Сейчас в API нет аутентификации: `userId` приходит query-параметром
(`@Query("userId", ParseUUIDPipe)`) в `ExpensesController`, о чём стоит TODO
(`apps/api/src/expenses/expenses.controller.ts:23`). Модель `User` в Prisma уже есть
(`email @unique`, `name?`, timestamps), но **без поля пароля**, а CQRS-инфраструктуры
(`@nestjs/cqrs`) и JWT в проекте нет.

Задача: добавить модуль пользователя (имя, email, хэш пароля) со слоями **репозиторий +
сервис**, модуль авторизации через JWT с эндпоинтами `register`/`login`/`me`, а взаимодействие
между модулями организовать **через CQRS без прямых импортов** (Auth не импортирует
`UsersService`, а общается с ним через `CommandBus`/`QueryBus`).

Решения пользователя: CQRS-граница сохраняется; guard сразу вешаем на `expenses` (userId из
токена вместо query); хэширование — `bcryptjs` (чистый JS, без node-gyp на Windows).
Валидация — существующий `ZodValidationPipe` на zod-схемах (в проекте class-validator запрещён,
см. CLAUDE.md → «Конвенции»), а не Nest `ValidationPipe`.

## Архитектурное решение (CQRS-граница)

`AuthModule` не импортирует `UsersService`/`UsersRepository`. Общая «поверхность» модуля Users —
классы команд/запросов (контракты); их можно импортировать обоим модулям, сервис/репозиторий — нет.
Слои внутри Users: **Repository (Prisma) → Service (бизнес-логика) → CQRS-хэндлеры (тонкие,
делегируют в Service)**.

- **register**: `AuthService` хэширует пароль (`bcryptjs`) → `commandBus.execute(new CreateUserCommand(...))`
  → `CreateUserHandler` → `UsersService.create` → `UsersRepository.create` → Auth подписывает JWT.
- **login**: `AuthService` → `queryBus.execute(new GetUserByEmailQuery(email))` → возвращает запись
  с `passwordHash` → Auth сверяет пароль и подписывает JWT.
- **me**: `AuthService` → `queryBus.execute(new GetUserByIdQuery(userId))` → возвращает `UserDto` без хэша.

Хэширование/сверка пароля и подпись JWT — целиком в Auth; Users лишь хранит переданный хэш.

## Чек-лист задач

### Подготовка

- [x] Установить зависимости `apps/api`: `@nestjs/cqrs`, `@nestjs/jwt`, `@nestjs/passport`,
      `passport`, `passport-jwt`, `bcryptjs` (+ dev `@types/passport-jwt`); версии `@nestjs/*` под v11
- [ ] Добавить `JWT_SECRET` в `.env` и `.env.example` ⚠️ файлы `.env*` закрыты правами — добавляет пользователь вручную

### БД (`packages/db`)

- [x] Добавить поле `passwordHash String` в модель `User` (`prisma/schema.prisma`)
- [x] `npm run db:generate` и `npm run db:migrate` (миграция `add_user_password_hash`)

### Общие схемы (`packages/shared/src/index.ts`)

- [x] `registerSchema` = `{ email: z.email(), name: z.string().min(1).max(120), password: z.string().min(8).max(72) }`
- [x] `loginSchema` = `{ email: z.email(), password: z.string().min(1) }`
- [x] Типы `RegisterDto`, `LoginDto` (`z.infer`)
- [x] Интерфейсы `UserDto { id, email, name: string | null }`, `AuthResponseDto { accessToken, user }` (без хэша)

### UsersModule (`apps/api/src/users/`)

- [x] `users.repository.ts` — `@Injectable`, инжектит `PrismaService`: `create`, `findByEmail`, `findById` (через `this.prisma.client.user.*`)
- [x] `users.service.ts` — `@Injectable`, инжектит `UsersRepository`: `create`, `findByEmail`, `findById`
- [x] `contracts/create-user.command.ts` — `CreateUserCommand(email, name, passwordHash)`
- [x] `contracts/get-user-by-email.query.ts` — `GetUserByEmailQuery(email)`
- [x] `contracts/get-user-by-id.query.ts` — `GetUserByIdQuery(id)`
- [x] `handlers/create-user.handler.ts` — `@CommandHandler`; ловит Prisma `P2002` → `ConflictException("Email уже занят")`
- [x] `handlers/get-user-by-email.handler.ts` — `@QueryHandler` → `findByEmail`
- [x] `handlers/get-user-by-id.handler.ts` — `@QueryHandler` → `findById`
- [x] `users.module.ts` — `imports: [CqrsModule]`, провайдеры: репозиторий, сервис, 3 хэндлера (контроллера нет)

### AuthModule (`apps/api/src/auth/`)

- [x] `jwt.strategy.ts` — `PassportStrategy(Strategy)`, `fromAuthHeaderAsBearerToken`, secret из `ConfigService`; `validate` → `{ userId, email }`
- [x] `jwt-auth.guard.ts` — `JwtAuthGuard extends AuthGuard("jwt")`
- [x] `current-user.decorator.ts` — `@CurrentUser()` возвращает `req.user.userId`
- [x] `auth.service.ts` — инжектит `CommandBus`/`QueryBus`/`JwtService`: `register`, `login`, `me`, приватные `buildResponse`/`toUserDto`
- [x] `auth.controller.ts` — `POST register` (201), `POST login` (200), `GET me` (`@UseGuards(JwtAuthGuard)`); пайп на `@Body`
- [x] `auth.module.ts` — `imports: [CqrsModule, PassportModule, JwtModule.registerAsync(...)]`, провайдеры + `exports: [JwtAuthGuard]` (UsersModule не импортируем — хэндлеры регистрируются глобально)

### Подключение guard к expenses

- [x] `expenses.controller.ts` — `@UseGuards(JwtAuthGuard)`, `@CurrentUser() userId` вместо `@Query`, убрать `Query` (`ParseUUIDPipe` остаётся для `:id`), снять TODO:23
- [x] `expenses.module.ts` — `imports: [AuthModule]`

### Корень

- [x] `app.module.ts` — добавить `UsersModule`, `AuthModule` в `imports`

### Тесты

- [x] `apps/api/src/auth/auth.service.spec.ts` — register хэширует+диспатчит; login бросает `UnauthorizedException` при неверном пароле; me отдаёт DTO без хэша
- [x] `apps/api/src/users/users.service.spec.ts` — делегирование в `UsersRepository`
- [x] `apps/api/test/auth.e2e-spec.ts` — register 201, дубль email 409, login 200, неверный пароль 401, `/me` без токена 401 / с токеном 200
- [x] Обновить `apps/api/test/expenses.e2e-spec.ts` — юзеры с `passwordHash`, регистрация через API, `Authorization: Bearer`, убрать `?userId=`, запрос без токена → 401
- [x] `JWT_SECRET` для e2e добавлен в `apps/api/vitest.config.e2e.ts` (`test.env`), чтобы `npm run test:e2e` работал из коробки

## Замороженные версии — не трогаем

TypeScript 5.9.3, ESLint 9.39.5, swc-трансформ Vitest остаются как есть (см. CLAUDE.md).
Новые `@nestjs/*` берём совместимыми с v11. `emitDecoratorMetadata` уже включён в `tsconfig` и в
Vitest-конфигах (`oxc:false` + `unplugin-swc`) — CQRS/Passport-декораторы на нём держатся,
менять конфиги не нужно.

## Проверка (end-to-end)

1. `npm run db:generate && npm run db:migrate` — применить поле `passwordHash`.
2. `npm run typecheck` и `npm run lint` — по всем воркспейсам.
3. `npm test` — юниты (`auth.service`, `users.service`, существующие 29) зелёные.
4. `docker compose up -d`, затем `npm run test:e2e` — auth-e2e и переписанные expenses-e2e зелёные.
5. Ручной прогон (`npm run dev`):
   - `POST /api/auth/register` `{email,name,password}` → 201, `accessToken` + `user` без хэша.
   - Повтор того же email → 409.
   - `POST /api/auth/login` → 200, токен.
   - `GET /api/auth/me` с `Authorization: Bearer <token>` → 200; без токена → 401.
   - `GET /api/expenses` без заголовка → 401; с токеном → 200 и только свои расходы.

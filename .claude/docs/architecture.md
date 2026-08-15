# Архитектура

Как устроен проект: границы, слои, модули и паттерны, на которых он держится. Команды и
соглашения по работе — в корневом `CLAUDE.md` и в `CLAUDE.md` приложений; здесь — устройство.

## Общая картина

```
┌─────────────────┐   fetch (server-side)   ┌─────────────────┐   Prisma    ┌────────────┐
│  apps/web       │ ──────────────────────► │  apps/api       │ ──────────► │ PostgreSQL │
│  Next.js :3000  │   Authorization: Bearer │  NestJS :3001   │  driver     │    :5433   │
│                 │ ◄────────────────────── │  префикс /api   │  adapter    │            │
└────────┬────────┘        JSON             └────────┬────────┘             └────────────┘
         │                                           │
         │ types + zod                               │ types + zod, Prisma Client
         └──────────────► packages/shared ◄──────────┘
                          packages/db ◄───────────────┘
```

Граф зависимостей воркспейсов: `web → shared`, `api → db, shared`. Библиотечные пакеты
компилируются `tsc` в `dist/` и подключаются как обычные npm-пакеты — поэтому в `turbo.json`
задача `dev` зависит от `^build`.

Браузер **никогда** не обращается к NestJS напрямую: между ними стоит BFF-слой Next.js.

## apps/api — слои

```
Controller   HTTP: маршруты, guard'ы, пайпы. Логики нет — делегирует в сервис
   ↓
Service      бизнес-правила, проверка владения записью, сборка DTO ответа
   ↓
PrismaService доступ к БД (у users дополнительно выделен Repository)
```

Дополнительные элементы:

| Элемент                     | Где       | Роль                                                                  |
| --------------------------- | --------- | --------------------------------------------------------------------- |
| `JwtAuthGuard`              | `auth/`   | пускает только с валидным Bearer-токеном                              |
| `JwtStrategy`               | `auth/`   | проверяет подпись и срок, кладёт `{ userId, email }` в `request.user` |
| `@CurrentUser()`            | `auth/`   | достаёт `userId` из `request.user` в аргумент метода                  |
| `ZodValidationPipe`         | `common/` | валидация zod-схемой; вешается **на параметр**                        |
| Глобальный `ValidationPipe` | `main.ts` | class-validator для DTO-классов                                       |
| `PrismaService`             | `prisma/` | содержит клиент Prisma; модуль глобальный                             |

### Модули

| Модуль         | HTTP                | Назначение                                                |
| -------------- | ------------------- | --------------------------------------------------------- |
| `auth`         | `/api/auth`         | регистрация, вход, профиль; владеет bcrypt и подписью JWT |
| `users`        | нет                 | хранение пользователей; наружу только CQRS-контракты      |
| `transactions` | `/api/transactions` | CRUD транзакций и агрегация за месяц                      |
| `categories`   | `/api/categories`   | CRUD категорий                                            |
| `payments`     | `/api/payments`     | регулярные платежи: шаблоны повторяющихся операций        |
| `prisma`       | нет                 | глобальный доступ к БД                                    |

## Паттерн: граница Users ↔ остальные модули через CQRS

`AuthModule`, `TransactionsModule`, `CategoriesModule` и `PaymentsModule` **не импортируют**
`UsersModule` и не инжектят `UsersService`. Общение идёт через `CommandBus`/`QueryBus` из
`@nestjs/cqrs`.

```
AuthService ──CreateUserCommand──►  CommandBus ──► CreateUserHandler ──► UsersService ──► UsersRepository
            ──GetUserByEmailQuery─►  QueryBus  ──► GetUserByEmailHandler ─┘
TransactionsService ─GetUserByIdQuery─► QueryBus ──► GetUserByIdHandler ──┘
```

Публичная поверхность модуля Users — только классы-контракты из `users/contracts/`:
`CreateUserCommand`, `GetUserByEmailQuery`, `GetUserByIdQuery`. `UsersService` и
`UsersRepository` в `exports` не значатся и снаружи недоступны.

Хэндлеры видны отовсюду потому, что `CqrsModule` регистрирует их глобально. Отсюда и
отсутствие импорта `UsersModule` в потребителях — **это не забытый импорт, не добавляйте его**.

Зачем `GetUserByIdQuery` перед созданием записи: токен живёт 7 дней и может пережить удаление
аккаунта. Нет пользователя → `UnauthorizedException`.

Разделение ответственности: хэширование пароля (`bcryptjs`) и подпись JWT живут в `AuthService`;
Users только сохраняет готовый `passwordHash` и отдаёт записи.

## Паттерн: изоляция пользователей

`userId` берётся **из токена**, а не из query-параметров. Все защищённые контроллеры закрыты
`@UseGuards(JwtAuthGuard)` на уровне класса, `userId` приходит через `@CurrentUser()`.
Query-параметры (`dateFrom/dateTo/type/categoryId`, `month/year`) — только фильтры.

Каждый запрос к БД фильтруется по `userId`, поэтому чужая запись неотличима от несуществующей
(в обоих случаях 404) — так не утекает даже факт её существования. Изоляция покрыта e2e.

## Паттерн: деньги — строки

В БД сумма — `Decimal(12,2)`. Наружу отдаётся `amount.toFixed(2)`, потому что JSON-число теряет
точность на копейках. Строка не приводится к `number` ни на бэкенде, ни на фронте; арифметика
делается методами `Prisma.Decimal` (`minus`, `plus`).

## Паттерн: два способа валидации

| Способ             | Где                          | Как                                                            |
| ------------------ | ---------------------------- | -------------------------------------------------------------- |
| zod (по умолчанию) | `auth`, `payments`           | схемы в `@repo/shared`, `@Body(new ZodValidationPipe(schema))` |
| class-validator    | `transactions`, `categories` | DTO-классы + глобальный `ValidationPipe`                       |

Это осознанное отступление, а не два стандарта: для новых модулей предпочтителен zod.
Глобальный `ValidationPipe` не ломает zod-контроллеры, потому что их `@Body`-типы — это
`z.infer`-алиасы, в рантайме метатип `Object`, и пайп их пропускает.

`ZodValidationPipe` вешается на параметр. Через `@UsePipes()` на методе он применится ко всем
аргументам, включая строковые path/query-параметры, и упадёт с «expected object, received
string» — такой баг уже был, теперь его ловят e2e.

## apps/web — Feature-Sliced Design

Слои сверху вниз, импорт только вниз: слой видит нижние, но не верхние и не соседей.

```
app       маршруты Next App Router, layout, BFF Route Handlers (тонкие обёртки)
views     страницы-композиции (FSD-слой «pages» переименован — «pages» занят Next)
widgets   самостоятельные блоки: auth-status, main-menu, user-profile, recent-transactions
features  пользовательские сценарии: auth/login, auth/register, auth/logout
entities  бизнес-сущности: session, transaction
shared    ui (shadcn), lib, api (клиент к Nest), config — без домена
```

Слайс наружу общается через `index.ts`; внутри — сегменты `ui/`, `model/`, `api/`, `lib/`,
`config/`. Алиас `@/* → src/*`.

Граница server/client строгая: серверные модули помечены `import "server-only"` и не
реэкспортируются через клиентский `index.ts` слайса — у `session` для этого отдельный
`server.ts`.

## Паттерн: BFF-авторизация, токен в httpOnly-куке

Клиент никогда не видит JWT.

```
форма (client)                → POST /api/auth/login  (свой же Next-хендлер, same-origin)
Route Handler → proxyAuth     → POST /api/auth/login  (Nest)
Nest                          → { accessToken, user }
Route Handler                 → Set-Cookie: session=<jwt>; HttpOnly   +  { user }
```

`getSession()` (`entities/session/server.ts`) читает куку и **валидирует токен** запросом к
`/auth/me`. Проверять по одному наличию куки нельзя: протухшая кука иначе даёт петлю
редиректов `/login → / → /login`. Гард залогиненного стоит в самих серверных `page.tsx`
(`if (await getSession()) redirect("/")`), а не в middleware — так результат едет вместе с
RSC-prefetch.

## packages

| Пакет          | Содержимое                                                             |
| -------------- | ---------------------------------------------------------------------- |
| `@repo/db`     | схема Prisma, миграции, сгенерированный клиент, `createPrismaClient()` |
| `@repo/shared` | zod-схемы и типы ответов, общие для фронта и бэка                      |

Особенности Prisma 7: строка подключения задаётся в `prisma.config.ts` (не в `datasource`),
генератор — `prisma-client` с обязательным `output`, driver adapter обязателен, клиент
собирается в CommonJS ради потребителя-NestJS. Подробности — в `database.md`.

## Документация API

`main.ts` поднимает Swagger UI на `/api/docs`. Документ строится после `setGlobalPrefix`,
поэтому пути в нём уже с `/api`. Схемы ответов — классы, которые `implements` интерфейсы из
`@repo/shared`: разойтись с контрактом молча они не могут, расхождение ловит `typecheck`.

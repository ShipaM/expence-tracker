# План: модуль категорий трат (Categories)

## Контекст

В API уже есть аутентификация (JWT) и CRUD расходов (`expenses`). Нужен полноценный
модуль категорий: сущность `Category` (id, name, color, **icon**, userId → User),
сервис (создание, список категорий пользователя, обновление, удаление), контроллер
с CRUD под JWT-гардом, валидация через **class-validator**, а модуль общается с
модулем `User` через **CQRS** (проверка существования пользователя).

### Что уже есть (важно — не создавать заново)

- **Модель `Category` уже в схеме Prisma** (`packages/db/prisma/schema.prisma`): `id, name,
color, userId`, FK на `User` (`onDelete: Cascade`), `@@unique([userId, name])`, обратная
  связь `expenses`. **Не хватает только поля `icon`.**
- Инфраструктура CQRS модуля `users`: контракт `GetUserByIdQuery`
  (`apps/api/src/users/contracts/get-user-by-id.query.ts`) и его хэндлер уже
  зарегистрированы глобально через `CqrsModule` — их можно диспетчить из нового модуля.
- Паттерн защищённого CRUD-контроллера — `apps/api/src/expenses/`: `@UseGuards(JwtAuthGuard)`
  на классе, `@CurrentUser() userId: string`, изоляция по `userId`, `ParseUUIDPipe` на `:id`.
- `JwtAuthGuard` экспортируется из `AuthModule`; `PrismaService` глобален (`PrismaModule` — `@Global()`).

### Осознанные отступления (подтверждены пользователем)

- **class-validator вместо zod.** `CLAUDE.md` предписывает «только zod». По явному решению
  пользователя категории валидируются через class-validator (DTO-классы + глобальный
  `ValidationPipe`). Потребуется установить `class-validator` и `class-transformer`.
  Существующие zod-контроллеры (auth, expenses) при этом не ломаются: их `@Body`-типы —
  это `z.infer`-алиасы (в рантайме метатип `Object`), поэтому глобальный `ValidationPipe`
  их пропускает, а `ZodValidationPipe` на параметре продолжает работать. По завершении стоит
  отразить это отступление в `CLAUDE.md` (по желанию).
- **CQRS ↔ User:** перед созданием категории сервис диспетчит `GetUserByIdQuery`; если
  пользователя нет — `UnauthorizedException` (токен живёт 7 дней, юзер мог быть удалён).

## Изменения

### 1. Схема БД + миграция — добавить поле `icon`

`packages/db/prisma/schema.prisma`, модель `Category`:

```prisma
model Category {
  id     String  @id @default(uuid()) @db.Uuid
  name   String
  color  String  @default("#6366f1")
  icon   String?              // новое: необязательный идентификатор иконки
  userId String  @db.Uuid
  ...
}
```

Затем: `npm run db:generate` и `npm run db:migrate` (миграция вида `add_category_icon`).
БД должна быть поднята (`docker compose up -d`, порт **5433** — см. CLAUDE.md).

### 2. Установить зависимости валидации

В `apps/api`: `class-validator` и `class-transformer` (в `dependencies`).

### 3. Включить глобальный ValidationPipe

`apps/api/src/main.ts`:

```ts
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);
```

(Не затрагивает zod-контроллеры — их DTO не классы.)

### 4. DTO-классы с class-validator

Новая папка `apps/api/src/categories/dto/`:

- `create-category.dto.ts`:
  ```ts
  export class CreateCategoryDto {
    @IsString() @Length(1, 60) name!: string;
    @IsOptional()
    @Matches(/^#[0-9a-fA-F]{6}$/, { message: "Ожидается HEX-цвет вида #a1b2c3" })
    color?: string; // в БД дефолт #6366f1
    @IsOptional() @IsString() @MaxLength(40) icon?: string;
  }
  ```
- `update-category.dto.ts`: те же поля, все `@IsOptional()` (без `@nestjs/mapped-types`,
  чтобы не тянуть новую зависимость).

### 5. Модуль/сервис/контроллер categories

Новая папка `apps/api/src/categories/` (образец — `apps/api/src/expenses/`):

- `categories.module.ts`:
  ```ts
  @Module({
    imports: [AuthModule, CqrsModule],   // AuthModule → JwtAuthGuard; CqrsModule → QueryBus
    controllers: [CategoriesController],
    providers: [CategoriesService],
    exports: [CategoriesService],
  })
  ```
- `categories.controller.ts`: `@Controller("categories")`, `@UseGuards(JwtAuthGuard)` на классе.
  Эндпоинты: `GET /` (findAll), `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` (`@HttpCode(204)`).
  `userId` — из `@CurrentUser()`; `:id` — через `ParseUUIDPipe`. Тела — DTO-классы (валидирует
  глобальный `ValidationPipe`).
- `categories.service.ts`: `constructor(prisma: PrismaService, queryBus: QueryBus)`.
  - `create(userId, dto)`: сначала `queryBus.execute(new GetUserByIdQuery(userId))` — нет юзера
    → `UnauthorizedException`; затем `prisma.client.category.create`. Конфликт `@@unique([userId, name])`
    (Prisma `P2002`) ловить утиной проверкой `code === "P2002"` (как в `create-user.handler.ts`)
    → `ConflictException("Категория с таким именем уже есть")`.
  - `findAll(userId)`: `where: { userId }`, `orderBy: { name: "asc" }`.
  - `findOne(userId, id)`: `findFirst({ where: { id, userId } })`, иначе `NotFoundException`
    (не 403 — не раскрываем существование чужого ресурса).
  - `update(userId, id, dto)`: сперва `findOne(userId, id)` (проверка владения), затем
    `update` только переданных полей (spread `...(dto.x !== undefined && { x })`); P2002 → 409.
  - `remove(userId, id)`: `findOne`, затем `delete` (у расходов `categoryId` обнулится —
    FK `onDelete: SetNull`).
  - приватный `toDto(category): CategoryDto` → `{ id, name, color, icon }`.

Импорт `GetUserByIdQuery` — из `../users/contracts/get-user-by-id.query` (контракты публичны).

### 6. Общие типы в @repo/shared

`packages/shared/src/index.ts`:

- Расширить `CategoryDto`: добавить `icon: string | null`.
- **Следствие:** `apps/api/src/expenses/expenses.service.ts` (`toDto`) собирает `category`
  как `{ id, name, color }` — добавить туда `icon: expense.category.icon`, иначе перестанет
  соответствовать обновлённому `CategoryDto` (typecheck упадёт). `include: { category: true }`
  уже тянет поле.
- (`createCategorySchema` в shared остаётся; API-валидация теперь на class-validator, но схему
  не удаляем — она может пригодиться фронту.)

### 7. Зарегистрировать модуль

`apps/api/src/app.module.ts` → добавить `CategoriesModule` в `imports`.

## Тесты

- **Юнит** `apps/api/src/categories/categories.service.spec.ts` (образец —
  `expenses.service.spec.ts`): мок `PrismaService` (`{ client: { category: {...} } }`) и мок
  `QueryBus`. Проверить: фильтрацию по `userId`, 404 на чужой ресурс, что `update`/`delete`
  не вызываются до проверки владения, `UnauthorizedException` когда `GetUserByIdQuery` вернул
  `null`, маппинг `toDto` (включая `icon`), обработку `P2002` → `ConflictException`.
- **E2E (рекомендуется)** `apps/api/test/categories.e2e-spec.ts` (образец —
  `expenses.e2e-spec.ts`): реальный токен через `POST /api/auth/register`, полный CRUD,
  изоляция пользователей (чужая категория → 404), конфликт имени → 409.

## Чеклист реализации

### БД и зависимости

- [x] Добавить `icon String?` в модель `Category` (`packages/db/prisma/schema.prisma`)
- [x] `npm run db:generate`
- [x] `npm run db:migrate` (миграция `add_category_icon`; контейнер на 5433 поднят)
- [x] Установить `class-validator` и `class-transformer` в `apps/api` (dependencies)

### Общие типы (@repo/shared)

- [x] Расширить `CategoryDto` полем `icon: string | null` (`packages/shared/src/index.ts`)
- [x] Добавить `icon` в маппинг `category` в `expenses.service.ts` (`toDto`) — иначе typecheck упадёт

### API — валидация

- [x] Включить глобальный `ValidationPipe` в `apps/api/src/main.ts`
- [x] `apps/api/src/categories/dto/create-category.dto.ts` (`@IsString/@Length/@Matches/@IsOptional`)
- [x] `apps/api/src/categories/dto/update-category.dto.ts` (все поля `@IsOptional`)

### API — модуль categories

- [x] `apps/api/src/categories/categories.service.ts` (CQRS-проверка юзера, изоляция по `userId`, P2002→409, `toDto`)
- [x] `apps/api/src/categories/categories.controller.ts` (`@Controller("categories")` + `@UseGuards(JwtAuthGuard)`, CRUD)
- [x] `apps/api/src/categories/categories.module.ts` (`imports: [AuthModule, CqrsModule]`, экспорт сервиса)
- [x] Зарегистрировать `CategoriesModule` в `apps/api/src/app.module.ts`

### Тесты

- [x] `apps/api/src/categories/categories.service.spec.ts` (мок `PrismaService` + `QueryBus`)
- [x] `apps/api/test/categories.e2e-spec.ts`

### Проверки

- [x] `npm run typecheck` + `npm run lint` — чисто
- [x] `npm test` — зелёные (33 юнита в api)
- [x] `npm run test:e2e` — зелёные (37 e2e)
- [ ] Ручная проверка CRUD `/api/categories` через `npm run dev` (по желанию — тесты уже покрывают весь CRUD)

## Верификация

1. `docker compose up -d` (порт 5433), убедиться, что `JWT_SECRET` есть в `.env`.
2. `npm run db:generate && npm run db:migrate`.
3. `npm run typecheck` и `npm run lint` — без ошибок (особенно проверка ripple по `CategoryDto`).
4. `npm test` — юнит-тесты (в т.ч. новый spec) зелёные.
5. `npm run test:e2e` — при добавлении e2e.
6. Ручная проверка: `npm run dev`, получить токен через `POST /api/auth/register`, затем
   `POST/GET/PATCH/DELETE /api/categories` с `Authorization: Bearer <token>` — проверить
   создание с `icon`, список, обновление, удаление и 401 без токена.

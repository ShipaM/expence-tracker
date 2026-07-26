# План: центральный модуль транзакций (Transaction)

## Контекст

Промпт (`.claude/prompts/transactions.md`) просит добавить центральный модуль учёта
доходов и расходов на модели `Transaction`. При этом в схеме **уже есть** модель `Expense`
с полем `type ExpenseType {INCOME, EXPENSE}` и рабочий модуль `apps/api/src/expenses/` —
он функционально дублирует то, что просят построить.

**Решение пользователя:** `Transaction` **заменяет** `Expense` и становится центральным
модулем. Старую модель/модуль/тесты `expenses` удаляем. БД в контейнере пустая
(см. CLAUDE.md), поэтому переносить данные не нужно — миграция просто пересоздаёт таблицу.

**Объём:** только API (NestJS + Prisma + тесты). Фронтенд — отдельной задачей.
**Валидация:** class-validator (по образцу модуля `categories`), взаимодействие с Users — через CQRS.
**Summary:** итоги (income/expense/balance) + разбивка по категориям.

Отличия `Transaction` от старого `Expense` (по промпту): нет `title`, `note`→`description`,
`spentAt`→`date`, `categoryId` **обязателен** (был nullable), нет `updatedAt`, свой enum.

## Шаги

### 1. Схема Prisma — `packages/db/prisma/schema.prisma`

- Заменить `enum ExpenseType` на `enum TransactionType { INCOME EXPENSE }`.
- Удалить `model Expense`, добавить `model Transaction`:

```prisma
model Transaction {
  id          String          @id @default(uuid()) @db.Uuid
  amount      Decimal         @db.Decimal(12, 2)   // деньги: Decimal(12,2), см. конвенции
  type        TransactionType
  description String?
  date        DateTime
  userId      String          @db.Uuid
  categoryId  String          @db.Uuid             // по промпту обязателен (не nullable)
  createdAt   DateTime        @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@index([categoryId])
  @@map("transactions")
}
```

- В `model User` и `model Category`: заменить `expenses Expense[]` на `transactions Transaction[]`.

> **Решение по `onDelete` категории:** т.к. `categoryId` обязателен, `SetNull` невозможен.
> Выбран `Cascade` — удаление категории удаляет её транзакции. Это сохраняет текущее
> поведение `CategoriesService.remove` (простой `delete` без ошибки FK). Альтернатива —
> `Restrict` (запретить удаление категории с транзакциями), но тогда пришлось бы менять
> модуль categories. Если предпочтителен `Restrict` — скажите.

### 2. Миграция и клиент

БД-контейнер должен быть поднят (`docker compose up -d`, порт **5433**).
Миграцию запускать **напрямую в `@repo/db`**, а не через turbo (turbo глотает `--name`,
см. память [[prisma-migrate-name-flag]]):

```bash
npm run db:migrate --workspace @repo/db -- --name add-transactions
npm run db:generate
```

Prisma сгенерирует DROP старой `expenses`/`ExpenseType` + CREATE `transactions`/`TransactionType`
(данных нет — безопасно).

### 3. Пакет `@repo/shared` — `packages/shared/src/index.ts`

Убрать всё «расходное», добавить «транзакционное» (input-валидация живёт в class-validator DTO,
поэтому в shared — только константы типов и response-DTO, как у categories):

- Удалить: `EXPENSE_TYPES`, `ExpenseType`, `createExpenseSchema`, `updateExpenseSchema`,
  `CreateExpenseDto`, `UpdateExpenseDto`, `ExpenseDto`.
- Добавить:

```ts
export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionDto {
  id: string;
  amount: string;              // Decimal → строка (toFixed(2))
  type: TransactionType;
  description: string | null;
  date: string;                // ISO
  category: CategoryDto;       // categoryId обязателен → категория всегда есть
  createdAt: string;
}

export interface TransactionSummaryDto {
  income: string;
  expense: string;
  balance: string;
  byCategory: {
    categoryId: string;
    name: string;
    type: TransactionType;
    total: string;
  }[];
}
```

- Обновить `packages/shared/src/index.spec.ts`: удалить блоки `createExpenseSchema`/
  `updateExpenseSchema` (тестировать транзакции в shared нечего — валидация ушла в class-validator).
  Оставить тесты `createCategorySchema`.

### 4. Новый модуль `apps/api/src/transactions/`

Скелет — по образцу `categories` (class-validator, `CqrsModule` + `QueryBus`, `toDto`).

**`dto/` (class-validator):**
- `create-transaction.dto.ts`:
  - `amount` — `@Matches(/^\d+(\.\d{1,2})?$/)` строка;
  - `type` — `@IsEnum(TransactionType)` (enum импортируется из `@repo/db`);
  - `description?` — `@IsOptional() @IsString() @MaxLength(500)`;
  - `date` — `@IsISO8601()` строка;
  - `categoryId` — `@IsUUID()`.
- `update-transaction.dto.ts` — все поля `@IsOptional()` (ручное дублирование, как в categories).
- `query-transactions.dto.ts` — фильтры списка: `dateFrom?`, `dateTo?` (`@IsOptional() @IsISO8601()`),
  `type?` (`@IsOptional() @IsEnum(TransactionType)`), `categoryId?` (`@IsOptional() @IsUUID()`).
- `summary-query.dto.ts` — `month` и `year` **обязательные**; `@Type(() => Number) @IsInt`,
  `month` `@Min(1) @Max(12)`, `year` `@Min(2000) @Max(2100)` (глобальный `ValidationPipe` с
  `transform: true` приведёт query-строки к числам).

**`transactions.controller.ts`** — `@Controller("transactions")` + `@UseGuards(JwtAuthGuard)`,
`@CurrentUser() userId`. Порядок объявления важен: **`GET /summary` до `GET /:id`**, иначе
`ParseUUIDPipe` на `:id` перехватит слово `summary`.

```
GET    /transactions/summary  (@Query summary-query)   → summary(userId, {month, year})
GET    /transactions          (@Query query-transactions) → findAll(userId, filters)
GET    /transactions/:id      (@Param id ParseUUIDPipe) → findOne(userId, id)
POST   /transactions          (@Body create-dto)        → create(userId, dto)
PATCH  /transactions/:id                                 → update(userId, id, dto)
DELETE /transactions/:id      @HttpCode(204)             → remove(userId, id)
```

**`transactions.service.ts`** — инжектит `PrismaService` + `QueryBus`:
- `findAll(userId, f)`: `where { userId, ...(f.type), ...(f.categoryId), ...(date: { gte: dateFrom, lte: dateTo }) }`,
  `include: { category: true }`, `orderBy: { date: "desc" }` → `toDto`.
- `findOne(userId, id)`: `findFirst({ where: { id, userId }, include: { category: true } })`,
  иначе `NotFoundException`.
- `create(userId, dto)`: как в categories — через `QueryBus`/`GetUserByIdQuery` проверить, что юзер
  жив (иначе `UnauthorizedException`); затем проверить, что категория принадлежит юзеру
  (`category.findFirst({ id: dto.categoryId, userId })`, иначе `NotFoundException`/`BadRequestException`);
  `create({ data: {...}, include: { category: true } })` → `toDto`.
- `update(userId, id, dto)`: `findOne` (проверка владения); если пришёл `categoryId` — проверить его
  принадлежность юзеру; `update` со спред-условиями `...(dto.x !== undefined && { x: dto.x })` → `toDto`.
- `remove(userId, id)`: `findOne`; `delete({ where: { id } })`.
- `summary(userId, month, year)`: диапазон `[Date.UTC(year, month-1, 1), Date.UTC(year, month, 1))`;
  - итоги — `groupBy({ by: ["type"], where, _sum: { amount: true } })`, из результата взять income/expense,
    `balance = income - expense` (арифметика Prisma `Decimal`), всё через `.toFixed(2)`;
  - `byCategory` — `groupBy({ by: ["categoryId", "type"], where, _sum: { amount: true } })`, затем
    догрузить имена категорий (`category.findMany` по собранным id) и собрать массив.
- `private toDto(tx): TransactionDto` — `amount: tx.amount.toFixed(2)`, `date: tx.date.toISOString()`,
  `createdAt: tx.createdAt.toISOString()`, вложенная `category` через `categoryToDto`.

**`transactions.module.ts`**: `imports: [AuthModule, CqrsModule]`, `controllers`, `providers`,
`exports: [TransactionsService]`.

**`transactions.service.spec.ts`** — по образцу `expenses.service.spec.ts`:
мок `prisma.client.transaction.*` + `client.category.*`, утиный `decimal()` для Decimal,
мок `QueryBus`. Кейсы: сериализация `amount` в строку, `NotFoundException`, изоляция по `userId`,
проверка категории, частичный update, фильтры в `where`, расчёт summary.

### 5. Подключить модуль и убрать старый

- `apps/api/src/app.module.ts`: заменить импорт и элемент массива `ExpensesModule` → `TransactionsModule`.
- `apps/api/src/main.ts`: поправить комментарий про zod-контроллеры (`auth, expenses` → `auth`;
  transactions теперь на class-validator).

### 6. Удалить артефакты Expense

- `apps/api/src/expenses/**` (controller, service, module, spec).
- `apps/api/test/expenses.e2e-spec.ts`.
- `apps/web/src/shared/api/expenses.ts` (импортирует удаляемые `CreateExpenseDto`/`ExpenseDto`,
  нигде не используется). **Проверить** баррел `apps/web/src/shared/api/index.ts` — если он
  реэкспортирует `expensesApi`, убрать реэкспорт, иначе сломается сборка web.

### 7. E2E — `apps/api/test/transactions.e2e-spec.ts`

По образцу `categories.e2e-spec.ts` (**с** `ValidationPipe`, т.к. class-validator):
- bootstrap: `setGlobalPrefix("api")` + `useGlobalPipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))`;
- токен — из `POST /api/auth/register` (`body.accessToken`); второй юзер для проверки изоляции;
- `beforeEach`: чистка в порядке FK — `transaction.deleteMany()` → `category.deleteMany()` → `user.deleteMany()`;
- кейсы: create (201) + категория в ответе; список и фильтры (`type`, `categoryId`, `dateFrom/dateTo`);
  summary (правильные суммы; **400** при отсутствии `month`/`year`); get/patch/delete (204);
  изоляция (чужая транзакция → 404); создание с чужой категорией → 404/400; без токена → 401;
  лишнее поле в body → 400 (whitelist).

### 8. Документация (рекомендуется)

Обновить упоминания expenses → transactions в `CLAUDE.md` (архитектура, модули api, конвенции,
строка статуса с числом тестов) и `docs/docs.md`. Это не влияет на сборку, но иначе гайд описывает
удалённый модуль.

## Критичные файлы

- `packages/db/prisma/schema.prisma` — модель, enum, обратные связи.
- `packages/shared/src/index.ts` + `index.spec.ts` — типы/DTO.
- `apps/api/src/transactions/**` — новый модуль (образец: `apps/api/src/categories/categories.{controller,service,module}.ts`).
- `apps/api/src/app.module.ts`, `apps/api/src/main.ts`.
- `apps/api/test/transactions.e2e-spec.ts` (образец: `apps/api/test/categories.e2e-spec.ts`).
- Переиспользуется: `../users/contracts/get-user-by-id.query`, `../auth/jwt-auth.guard`,
  `../auth/current-user.decorator`, `PrismaService.client`.

## Чеклист реализации

- [x] 1. Схема: `enum TransactionType`, `model Transaction`, связи `transactions Transaction[]` в User/Category, удалить `Expense`/`ExpenseType` (`packages/db/prisma/schema.prisma`)
- [x] 2. Миграция `add-transactions` напрямую в `@repo/db` + `db:generate` (`20260723174742_add_transactions`)
- [x] 3. `@repo/shared`: убрать expense-типы/схемы, добавить `TRANSACTION_TYPES`, `TransactionType`, `TransactionDto`, `TransactionSummaryDto`; поправить `index.spec.ts`
- [x] 4. DTO модуля: `create/update/query-transactions.dto.ts`, `summary-query.dto.ts` (class-validator)
- [x] 5. `transactions.service.ts` (CRUD + фильтры + summary + `toDto`, CQRS-проверка юзера и владения категорией)
- [x] 6. `transactions.controller.ts` (порядок: `/summary` до `/:id`) + `transactions.module.ts`
- [x] 7. `transactions.service.spec.ts` (16 юнитов)
- [x] 8. Подключить `TransactionsModule` в `app.module.ts`; поправить комментарий в `main.ts`
- [x] 9. Удалить `apps/api/src/expenses/**`, `apps/api/test/expenses.e2e-spec.ts`, `apps/web/src/shared/api/expenses.ts`; поправить чистку `expense`→`transaction` в auth/categories e2e
- [x] 10. `apps/api/test/transactions.e2e-spec.ts` (17 e2e)
- [x] 11. Синхронизировать документацию (`CLAUDE.md`, `docs/docs.md`)
- [x] 12. Проверка пройдена: typecheck ✓, build ✓, unit 43 ✓, e2e 42 ✓

## Проверка (по завершении)

```bash
docker compose up -d                                   # БД на :5433
npm run db:migrate --workspace @repo/db -- --name add-transactions
npm run db:generate
npm run typecheck
npm run build                                          # промпт требует сборку; NODE_ENV не должен быть development
npm test                                               # юниты (в т.ч. новый transactions.service.spec)
npm run test:e2e                                       # нужен запущенный контейнер
```

Ручная проверка (после `npm run dev`, с Bearer из `/api/auth/register`):
`POST /api/transactions` → `GET /api/transactions?type=EXPENSE` →
`GET /api/transactions/summary?month=7&year=2026` → `PATCH` → `DELETE`.
Отдельно убедиться: `GET /api/transactions/summary` не ловится роутом `:id`;
запрос без `month`/`year` возвращает 400; чужие транзакции/категории недоступны.

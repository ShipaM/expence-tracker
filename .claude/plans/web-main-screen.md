# План: главный экран (web) — профиль, меню, последние транзакции

Ветка: `feature/main-screen` (GitHub Flow).

## Контекст

Сейчас `/` — статичная заглушка ([apps/web/src/app/page.tsx](../../apps/web/src/app/page.tsx)):
заголовок, абзац-плейсхолдер и виджет `AuthStatus`. Данных не грузит, на авторизацию не гейтит.
Нужен полноценный **главный экран** залогиненного пользователя:

- профиль (отображение имени),
- меню-навигация к транзакциям и категориям,
- список последних 10 транзакций с пагинацией.

Фронт — по Feature-Sliced Design, как остальной `apps/web` (см. `web-auth-fsd.md`).

Блокер, вскрытый разведкой: `GET /api/transactions` отдаёт **плоский массив всех** транзакций
(сортировка `date desc`), без `page/limit/total`
([transactions.service.ts:34](../../apps/api/src/transactions/transactions.service.ts#L34)).
Серверной пагинации ещё нет — её добавляем.

## Решения (согласованы с пользователем)

1. **Пагинация — серверная.** Добавляем `page/limit` в API, ответ — обёртка
   `{ items, total, page, limit }`. Ломающее изменение контракта списка (коммит `feat(api)!`).
2. **Меню — только ссылки** на `/transactions` и `/categories`. Сами страницы — отдельные
   задачи позже; пока переход даёт 404, это ожидаемо.
3. **Гость → редирект на `/login`.** Гейт в `page.tsx` через `getSession()` (источник истины,
   как в гардах `/login` и `/register`).

Пагинация на фронте — **через URL search param** (`/?page=N`): экран серверный, перефетчит
страницу сам. Идиоматично для App Router, переиспользует серверный fetch-паттерн
(`getSession` / `nestJson` + токен из httpOnly-куки), без клиентского fetch и без BFF-роута для чтения.

---

## Чеклист выполнения

Часть A — API (один коммит `feat(api)!`):
- [x] A1. `page/limit` в `QueryTransactionsDto`
- [x] A2. `findAll`: `skip/take` + `count`, возврат обёртки
- [x] A3. Тип возврата контроллера → `PaginatedTransactionsDto`
- [x] A4. `PaginatedTransactionsDto` в `@repo/shared`
- [x] A5. Юнит-тест `transactions.service.spec.ts` (мок `count`, обёртка, кейс `skip/take`)
- [x] A6. E2E `transactions.e2e-spec.ts` (обёртка + кейс пагинации)
- [x] A7. `typecheck` ✅ + юнит ✅ (17) + e2e ✅ (18)

Часть B — фронтенд FSD (один коммит `feat(web)`):
- [x] B1. `entities/transaction` (`transactions.server.ts`, `lib/format.ts`, `index.ts`, `server.ts`)
- [x] B2. `widgets/user-profile`
- [x] B3. `widgets/main-menu`
- [x] B4. `widgets/recent-transactions` (список + строка + пагинатор)
- [x] B5. `views/home`
- [x] B6. `app/page.tsx` — гейт + делегирование
- [x] B7. typecheck ✅ + lint ✅ + build ✅ (`/` → dynamic) + живой smoke ✅ (редирект гостя, профиль, меню, 10+пагинация, пустое состояние)

---

## Шаги

### Часть A. API — серверная пагинация

**A1. DTO** — [query-transactions.dto.ts](../../apps/api/src/transactions/dto/query-transactions.dto.ts)
Добавить два опциональных поля (паттерн `@Type(() => Number)` уже применяется в `summary-query.dto.ts`):
```ts
@IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
```

**A2. Сервис** — [transactions.service.ts](../../apps/api/src/transactions/transactions.service.ts) `findAll`
Дефолты `page = filters.page ?? 1`, `limit = filters.limit ?? 20`; `skip = (page-1)*limit`.
Заменить один `findMany` на параллельные `findMany({ ..., skip, take: limit })` + `count({ where })`
(`Promise.all`), сохранив `orderBy: { date: "desc" }` и `include: { category: true }`. Вернуть
`{ items: rows.map(toDto), total, page, limit }`. Тип возврата — `PaginatedTransactionsDto`.

**A3. Контроллер** — [transactions.controller.ts:38](../../apps/api/src/transactions/transactions.controller.ts#L38)
Тип возврата `findAll` → `Promise<PaginatedTransactionsDto>`. Тело метода не меняется.

**A4. Shared-тип** — [packages/shared/src/index.ts](../../packages/shared/src/index.ts)
Рядом с `TransactionDto`:
```ts
export interface PaginatedTransactionsDto {
  items: TransactionDto[];
  total: number;
  page: number;
  limit: number;
}
```

**A5. Юнит** — [transactions.service.spec.ts](../../apps/api/src/transactions/transactions.service.spec.ts)
В мок `client.transaction` добавить `count`; обновить ожидания `findAll` на обёртку; кейс на
`skip/take` при заданных `page/limit`.

**A6. E2E** — [transactions.e2e-spec.ts](../../apps/api/test/transactions.e2e-spec.ts)
Проверки списка — с массива на `body.items` / `body.total`; добавить кейс пагинации (создать
>limit транзакций, проверить `page=2` и `total`). Изоляцию по `userId` и порядок `date desc` — сохранить.

### Часть B. Фронтенд (FSD)

Слайсы наружу — через `index.ts`; серверные модули — `import "server-only"` + отдельный `server.ts`
(как у `entities/session`).

**B1. `entities/transaction/`**
- `model/transactions.server.ts` (`server-only`): `getTransactions({ page, limit })` — токен из
  `SESSION_COOKIE` (`cookies()`), `nestJson<PaginatedTransactionsDto>("/transactions?page=..&limit=..", { token })`.
  Зеркалит [session.server.ts](../../apps/web/src/entities/session/model/session.server.ts).
- `lib/format.ts`: `formatAmount(amount, type)`, `formatDate(iso)` (сумма — строка, `Intl.NumberFormat`).
- `server.ts` → `getTransactions`; `index.ts` → реэкспорт `lib/format`.

**B2. `widgets/user-profile/`** — `ui/UserProfile.tsx` (`"use client"`): `useSession()` →
`user.name ?? user.email` (nullable), рядом `LogoutButton`. Оформить карточкой (shadcn `Card`).
Паттерн — как [AuthStatus.tsx](../../apps/web/src/widgets/auth-status/ui/AuthStatus.tsx).

**B3. `widgets/main-menu/`** — `ui/MainMenu.tsx` (серверный): `Button asChild` + `Link` на
`/transactions` и `/categories`.

**B4. `widgets/recent-transactions/`** (серверный, проп `page`):
- `ui/RecentTransactions.tsx`: `getTransactions({ page, limit: 10 })`, рендер `items` (пусто →
  «Транзакций пока нет»), под списком — пагинатор.
- `ui/TransactionRow.tsx`: `category.name`, дата, сумма (цвет по типу), `description`.
- `ui/Pagination.tsx`: «Назад»/«Вперёд» как `Link` на `/?page=N`; «Назад» off при `page<=1`,
  «Вперёд» off при `page*limit >= total`; страниц — `Math.ceil(total/limit)`.

**B5. `views/home/`** — `ui/HomePage.tsx` (серверный, проп `page`): `UserProfile` + `MainMenu` +
`RecentTransactions` в `<main>` (стиль как текущий `page.tsx`). `index.ts` → `HomePage`.

**B6. `app/page.tsx`**:
```tsx
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!(await getSession())) redirect("/login");   // из @/entities/session/server
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return <HomePage page={page} />;
}
```

---

## Verification

```bash
# API
npm run typecheck
npm run test --workspace @repo/api -- src/transactions/transactions.service.spec.ts
docker compose up -d && npm run test:e2e     # нужен контейнер БД (:5433)

# Web
npm run build --workspace @repo/shared
NODE_ENV=production npm run build --workspace @repo/web   # ловушка next build + NODE_ENV
```

Вручную (`npm run dev`, `JWT_SECRET` в `.env`):
1. Гость на `/` → редирект на `/login`.
2. Логин → `/` показывает имя (или email), меню и список.
3. Меню: ссылки ведут на `/transactions` и `/categories` (пока 404 — ожидаемо).
4. Создать >10 транзакций → на `/` видно 10 новых первыми; «Вперёд» → `/?page=2`, «Назад» с 1-й off.
5. Пустой аккаунт → «Транзакций пока нет».

## Правки по код-ревью (hardening)

- [x] `app/error.tsx` — граница ошибок маршрута: мягкий фолбэк вместо падения при сбое
  серверного фетча (недоступный API / протухший токен между `getSession` и списком).
- [x] Кламп страницы в `RecentTransactions`: запрос за пределом (`/?page=99`) редиректит на
  последнюю валидную страницу — убирает «Страница 99 из 2» над пустым списком.
  Проверено вживую: `/?page=99` → 307 → `/?page=2`.

## Коммиты (GitHub Flow)

- `feat(api)!: paginate transactions list` (Часть A).
- `feat(web): add main screen (profile, menu, recent transactions)` (Часть B).

# План: добавление категорий на фронтенде

## Контекст

Бэкенд готов полностью: `POST /api/categories` работает, закрыт `JwtAuthGuard`, уникальность
имени в пределах пользователя ловится в сервисе и отдаётся как **409**. На фронте категорий нет
вообще — ссылка «Категории» в `widgets/main-menu` ведёт на `/categories`, которой не существует,
и даёт 404.

### Что уже есть — не создавать заново

- **`createCategorySchema` в `@repo/shared`** (`name` 1–60, `color` — HEX `#a1b2c3`) и тип
  `CategoryDto`. Схема переиспользуется формой через `zodResolver`.
- **Паттерн BFF:** клиент никогда не видит JWT. Форма шлёт запрос на свой Route Handler,
  тот берёт токен из httpOnly-куки и ходит в Nest (`nestFetch` из `shared/api/nest.ts`,
  `server-only`).
- **Паттерн серверного чтения:** `entities/transaction/model/transactions.server.ts` — токен из
  куки, `nestJson`, вызов из серверного виджета.
- **Маппинг 409 на поле формы** уже сделан в `features/auth/register/model/use-register.ts` —
  повторяем один в один.
- **Гейт приватной страницы:** `if (!(await getSession())) redirect("/login")` прямо в
  серверном `page.tsx` (как в `app/page.tsx`), а не через middleware.
- **Визуальный язык «книга учёта»:** константы `LEDGER_LABEL`, `LEDGER_INPUT`, `LEDGER_SUBMIT`
  в `shared/ui/ledger-field.ts`; палитра — токены `ink`/`rule`/`sheet`/`credit`/`debit`.

## Границы задачи

**В работе:** страница `/categories` — список категорий пользователя и форма добавления.

**За рамками (отдельными задачами):** редактирование и удаление категорий, выбор иконки,
фильтрация транзакций по категории. Причина: просили добавление; список нужен потому, что
без него добавленное некуда показать и не видно, какие имена уже заняты.

## Решения, которые стоит подтвердить

1. **Цвет — палитра из готовых образцов, а не поле для HEX.** Ручной ввод `#a1b2c3` — плохой
   ввод для человека и лишний источник ошибок валидации. Восемь образцов из палитры проекта,
   выбор радиогруппой; схема всё равно проверяет формат.
2. **Страница, а не модальное окно.** Ссылка в меню уже ведёт на `/categories`, заодно чинится 404. Модалка потребовала бы `Dialog` из shadcn, которого в проекте пока нет.
3. **Route Handler, а не Server Action.** Так требует зафиксированный в `CLAUDE.md` паттерн BFF;
   форма остаётся клиентской и переиспользует `react-hook-form` как остальные формы проекта.

## Изменения

### 1. `entities/category` — чтение списка

```
entities/category/
  model/categories.server.ts   getCategories(): Promise<CategoryDto[]> — server-only,
                               токен из куки, nestJson("/categories")
  server.ts                    серверный вход слайса (реэкспорт)
  index.ts                     клиентская поверхность: пока только реэкспорт типа
```

Серверный модуль **не** реэкспортируется из `index.ts` — граница как у `entities/session`
и `entities/transaction`.

### 2. BFF: `app/api/categories/route.ts`

`POST` — читает тело, берёт токен из `SESSION_COOKIE`, проксирует в Nest, **пробрасывает статус
и тело как есть** (409 и 400 нужны форме). Без токена — 401, не ходя в Nest.

### 3. `features/category/create`

```
features/category/create/
  model/use-create-category.ts   RHF + zodResolver(createCategorySchema),
                                 POST /api/categories, 409 → ошибка поля name,
                                 успех → form.reset() + router.refresh()
  ui/CreateCategoryForm.tsx      поле имени, радиогруппа цвета, кнопка
  index.ts
```

`router.refresh()` перерисовывает серверный список — добавленная категория появляется без
перезагрузки страницы.

### 4. `widgets/category-list`

Серверный виджет: `getCategories()`, список с цветовой меткой и именем. Пустое состояние —
приглашение к действию, а не «ничего нет».

### 5. `views/categories` + `app/categories/page.tsx`

Страница под гейтом `getSession()`. Композиция: заголовок, форма, список.

### 6. Тесты

`CreateCategoryForm.spec.tsx` — Vitest + Testing Library по конвенциям `apps/web`:
пустое имя не отправляется, успешная отправка зовёт `fetch` с нужным телом, 409 садится
на поле имени, во время отправки кнопка заблокирована. `fetch` и `useRouter` мокаются.

### 7. Документация

`apps/web/CLAUDE.md` — новые слайсы в описании FSD и снятие утверждения, что фронтенда
категорий нет.

## Порядок выполнения

Строго по одной задаче, с остановкой на подтверждение после каждой:

1. `entities/category` + BFF-роут (данные ходят в обе стороны)
2. `features/category/create` — форма
3. `widgets/category-list` + `views/categories` + маршрут
4. Тесты формы
5. Документация

## Проверка

`npm run test --workspace @repo/web`, `npm run typecheck`, `npm run lint`, затем вручную:
добавить категорию, повторить то же имя (ожидается 409 под полем), проверить, что список
обновился без перезагрузки.

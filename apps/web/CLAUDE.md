# CLAUDE.md — apps/web

Указания для Claude Code при работе с фронтендом (`@repo/web`). Здесь только фронтенд.
Общее для монорепо (корневые команды, Prisma/`packages/db`, политика версий, коммиты) —
в корневом `CLAUDE.md`. Бэкенд — в `apps/api/CLAUDE.md`.

## Что это

Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, порт `:3000`. Зависит от `@repo/shared`.

Текущее состояние: на главной — статичная заглушка; авторизация на фронте есть (login/register/
logout через BFF), фронтенд транзакций (страница/фичи FSD, BFF `/api/transactions`) ещё не сделан —
запланирован отдельной задачей поверх API-модуля `transactions`.

## Команды

Только фронтенд (из корня, через воркспейс). `@repo/shared` должен быть собран — при запуске
из корня Turbo делает это сам.

```bash
npm run dev --workspace @repo/web        # next dev на :3000
npm run build --workspace @repo/web      # см. «next build и NODE_ENV»
npm run start --workspace @repo/web      # next start на :3000 (после build)
npm run lint --workspace @repo/web
npm run typecheck --workspace @repo/web
npm run clean --workspace @repo/web      # удалить .next

npm run test --workspace @repo/web       # компонентные тесты (Vitest + jsdom)
npm run test:watch --workspace @repo/web
npm run test:coverage --workspace @repo/web

npx shadcn@latest add <component>        # запускать из apps/web — см. «UI»
```

## Feature-Sliced Design

Слои сверху вниз, импорт — **только вниз** (слой видит нижние, не верхние и не соседей своего
уровня):

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

## Авторизация — паттерн BFF, токен в httpOnly-куке

Клиент **никогда** не видит JWT: форма (`features/auth/*`, react-hook-form + `zodResolver` со
схемами из `@repo/shared`) шлёт запрос на свой же Route Handler
`POST /api/auth/{login,register,logout}` (same-origin). Хендлер (`proxyAuth` в
`shared/api/auth.server.ts`) ходит в Nest, получает `accessToken` и кладёт его в httpOnly-куку
`session` (`shared/config/cookie.ts`), наружу отдаёт только `{ user }`. Ошибки бэкенда (401/409/400)
пробрасываются со статусом и `message`; фичи маппят их на поля (409 → email) или корневую ошибку
формы (401). `getSession()` (`entities/session/server.ts`, `server-only`) читает куку и валидирует
токен запросом к `/auth/me`.

Залогиненного со страниц `/login` и `/register` уводит на `/` **гард в самих серверных `page.tsx`**
(`if (await getSession()) redirect("/")`), а не middleware: результат едет вместе с RSC-prefetch,
поэтому навигация гостя мгновенна, без блокирующего сетевого вызова на каждый запрос. Проверять по
одному лишь наличию куки нельзя — протухшая кука (напр. после смены секрета на бэкенде) иначе даёт
петлю редиректов `/login → / → /login`: `getSession` её отвергает и рисует «Войти», а presence-гард
редиректит обратно. Поэтому источник истины один — `getSession`.
(Прежний `proxy.ts`/`middleware` удалён; для будущей защиты приватных маршрутов вернём отдельно.)

**Граница server/client строгая:** серверные модули помечены `import "server-only"` и НЕ
реэкспортируются через клиентский `index.ts` слайса (для `session` серверный вход — отдельный
`server.ts`). `shared/api/nest.ts` (`nestFetch`/`nestJson`) — тоже только сервер.

## UI

**shadcn/ui живёт в `shared/ui`.** Алиасы в `apps/web/components.json` перенастроены на
`@/shared/*` (`ui`, `lib`, `utils`), поэтому `npx shadcn@latest add <c>` кладёт компоненты сразу
туда.

**Tailwind 4 без `tailwind.config.js`.** Тема и токены объявлены прямо в
`apps/web/src/app/globals.css` (`@theme inline`, CSS-переменные).

**Палитра «книга учёта».** Шесть базовых токенов — `--ground` (фон-стол), `--sheet` (лист),
`--ink` (текст), `--rule` (линовка), `--debit` (красный) и `--credit` (зелёный). Красный и
зелёный не декоративные акценты, а двойная запись: расход и приход, и переиспользовать их
под другое не нужно. Токены shadcn (`--background`, `--primary`, `--destructive` и прочие)
объявлены **псевдонимами** этих шести, поэтому компоненты в `shared/ui` берут палитру, не
меняя своих классов. В `.dark` переопределяются только базовые шесть — псевдонимы
подхватывают их сами.

**Классы компонентов из `shared/ui` не правим ради оформления:** на них висят юнит-тесты,
которые сверяют строки классов (`h-9`, `size-4`, `bg-primary`). Всё, что нужно поверх,
накладывается через `className` на месте вызова — конфликты снимает `twMerge` внутри `cn`.
Готовые наборы для форм в стиле книги учёта лежат в `shared/ui/ledger-field.ts`.

**Шрифты — `next/font/google`, три роли** (`layout.tsx`): Unbounded — дисплейный, только
вордмарк; Golos Text — текст; JetBrains Mono — служебные метки и цифры. Все три обязаны
нести кириллицу, это отсекает большинство «красивых» вариантов; при замене проверяйте
`subsets: ["cyrillic"]`, иначе Next молча отдаст латиницу с подставленными глифами.

**Экраны авторизации** собраны на `widgets/auth-frame` (лист с вкладками «Вход ↔ Регистрация»)
и `shared/ui/balance-rule.tsx` — вертикальная линия в левой марже формы, по сегменту на поле:
чернила при валидном, красный при ошибке, зелёный и метка «сведено», когда сошлись все.
Линия скрыта от скринридера (`aria-hidden`), потому что то же состояние уже озвучивают
`FormMessage` и `aria-invalid` полей.

**Денежные суммы приходят с бэкенда строками** (`Decimal(12,2)` → `toFixed(2)`): JSON-число
теряет точность на копейках. Не приводите их к `number` для расчётов на клиенте.

## `npm run dev` падает сразу после старта — сначала проверьте :3000

`next dev --port 3000` с **явно заданным портом не подбирает свободный**, а падает с кодом 1:

```
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use :::3000
```

Через turbo эту строку легко не заметить: сверху ложится generic-обёртка npm
(`npm error command failed`, `npm error command ... next dev --port 3000`), а в итоге видно
только `Failed: @repo/web#dev` — выглядит как поломка сборки, хотя порт просто занят.
Прошлый `next dev` переживает остановку родительской задачи так же, как `nest start --watch`
держит :3001 (см. `apps/api/CLAUDE.md`).

```bash
netstat -ano | grep ':3000 ' | grep LISTENING   # найти PID
taskkill //F //PID <pid>                        # освободить (Git Bash: двойной слеш)
```

Порт в скрипте зафиксирован намеренно — не меняйте на автоподбор: CORS у API разрешает
`CORS_ORIGIN ?? "http://localhost:3000"` (`apps/api/src/main.ts`), и на уехавшем порту
фронтенд начнёт получать отказы CORS — это отлаживать дольше, чем `EADDRINUSE`.

## next build и NODE_ENV

`next build` ломается, если в окружении заранее выставлен `NODE_ENV=development`: React грузит
dev-сборку, и пререндер падает с `Cannot read properties of null (reading 'useContext')` на
странице `/_global-error`. Признак — предупреждение «You are using a non-standard NODE_ENV
value» в начале лога. Лечится запуском с `NODE_ENV=production` или снятием переменной.

## Тесты

Vitest 4 + Testing Library, окружение `jsdom`. Тесты — `*.spec.tsx` рядом с компонентом
(`src/**/*.spec.{ts,tsx}`), как в `api`; папки `__tests__` не заводим.

**JSX трансформирует `@vitejs/plugin-react`, а не встроенный трансформер Vitest.** В
`tsconfig.json` стоит `jsx: "preserve"` — так нужно Next, но с ним Vitest не соберёт компоненты
сам. Плагин подключён в `apps/web/vitest.config.ts`; не убирайте его.

`vitest.setup.ts` подключает матчеры `@testing-library/jest-dom` и зовёт `cleanup()` в
`afterEach` — без этого DOM предыдущего кейса остаётся в документе и `getBy*` находит чужие узлы.

Алиас `@/*` продублирован в `resolve.alias` конфига: Vitest не читает `paths` из `tsconfig`,
и без этого импорты вида `@/shared/lib/utils` в тестах не резолвятся.

Тесты компонентов не поднимают Next: серверные модули (`server-only`, `getSession`, BFF-хендлеры)
юнитами не покрываются — для них нужен либо мок, либо e2e.

## ESLint

`apps/web/eslint.config.mjs` импортирует готовые flat-массивы из
`eslint-config-next/core-web-vitals` и `/typescript` (FlatCompat не нужен — Next 16 отдаёт
flat-config напрямую).

ESLint заморожен на 9.39.5 именно из-за этого конфига: `eslint-config-next` тянет
`eslint-plugin-react` 7.37, который под ESLint 10 падает с
`contextOrFilename.getFilename is not a function`. Не поднимайте до 10.x.

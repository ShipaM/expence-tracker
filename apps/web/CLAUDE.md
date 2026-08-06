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

npx shadcn@latest add <component>        # запускать из apps/web — см. «UI»
```

Тестовых скриптов у воркспейса нет (см. «Тесты»).

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
`apps/web/src/app/globals.css` (`@theme inline`, CSS-переменные). Файл дополнен недостающими
neutral-переменными (`--input`, `--ring`, `--secondary`, `--accent`, `--popover` и их
`-foreground`) — без них компоненты shadcn рендерятся с пустыми цветами.

**Денежные суммы приходят с бэкенда строками** (`Decimal(12,2)` → `toFixed(2)`): JSON-число
теряет точность на копейках. Не приводите их к `number` для расчётов на клиенте.

## next build и NODE_ENV

`next build` ломается, если в окружении заранее выставлен `NODE_ENV=development`: React грузит
dev-сборку, и пререндер падает с `Cannot read properties of null (reading 'useContext')` на
странице `/_global-error`. Признак — предупреждение «You are using a non-standard NODE_ENV
value» в начале лога. Лечится запуском с `NODE_ENV=production` или снятием переменной.

## Тесты

Тестов для `web` пока нет — при добавлении компонентов понадобятся `@testing-library/react`
и `environment: "jsdom"`.

## ESLint

`apps/web/eslint.config.mjs` импортирует готовые flat-массивы из
`eslint-config-next/core-web-vitals` и `/typescript` (FlatCompat не нужен — Next 16 отдаёт
flat-config напрямую).

ESLint заморожен на 9.39.5 именно из-за этого конфига: `eslint-config-next` тянет
`eslint-plugin-react` 7.37, который под ESLint 10 падает с
`contextOrFilename.getFilename is not a function`. Не поднимайте до 10.x.

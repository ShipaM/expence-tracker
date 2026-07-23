# Фронтенд: страницы логина и регистрации (FSD + shadcn/ui)

## Контекст

Фронт (`apps/web`, Next.js 16 App Router, React 19, Tailwind 4) сейчас — статичная
заглушка на `/`. Авторизация есть только на API: `POST /api/auth/register` и
`POST /api/auth/login` возвращают `AuthResponseDto { accessToken, user }`,
`GET /api/auth/me` (guard) возвращает `UserDto`. Задача — сделать рабочие страницы
входа и регистрации на shadcn/ui и заложить архитектуру **Feature-Sliced Design**
как основу фронта (с фиксацией в `CLAUDE.md`).

Решения, согласованные с пользователем:
- **Сессия — httpOnly-кука через Next Route Handler (BFF-прокси).** Клиент никогда не
  видит токен: форма шлёт запрос на свой Route Handler `/api/auth/*`, тот ходит в Nest,
  получает `accessToken` и кладёт его в httpOnly-куку `session`.
- **Формы — react-hook-form + shadcn `Form` + `zodResolver`** с существующими
  `loginSchema` / `registerSchema` из `@repo/shared`.
- **Полная миграция shared-слоя** под FSD: `lib/*` и `components/ui` переезжают в
  `shared/*`, алиасы shadcn перенастраиваются.

## Контракт API (готов, не трогаем)

- `POST /api/auth/register` → 201, тело `{ accessToken, user }`. Ошибка 409
  `{ message: "Email уже занят", statusCode: 409 }`; 400 валидация
  `{ message: "Ошибка валидации", issues: [...], statusCode: 400 }`.
- `POST /api/auth/login` → 200, тело `{ accessToken, user }`. Ошибка 401
  `{ message: "Неверный email или пароль", statusCode: 401 }`.
- `GET /api/auth/me` → 200 `{ id, email, name }`, заголовок `Authorization: Bearer <token>`.
- CORS в Nest открыт для `http://localhost:3000`, но при BFF-подходе кросс-доменные
  запросы делает сервер Next, не браузер.
- Токен живёт `7d` (учесть в `maxAge` куки).

Схемы `registerSchema` (`email`, `name` 1..120, `password` 8..72),
`loginSchema` (`email`, `password` min 1) и типы `RegisterDto/LoginDto/UserDto/AuthResponseDto`
берём из `@repo/shared` — `packages/shared/src/index.ts`.

## Целевая структура FSD (`apps/web/src`)

Next App Router занимает `src/app`, поэтому FSD-слой «pages» переименован в **`views`**,
а app-layer-обязанности (провайдеры) сведены в корневой `layout.tsx`. Импорты — только
вниз по слоям: `app → views → features → entities → shared`.

```
src/
├── app/                              # Next App Router — тонкие маршруты + BFF
│   ├── layout.tsx                    # оборачивает children в SessionProvider (сервер читает /me)
│   ├── globals.css                   # остаётся здесь; дополняется токенами (см. ниже)
│   ├── page.tsx                      # главная-заглушка + кнопка «Выйти» (если есть сессия)
│   ├── (auth)/
│   │   ├── login/page.tsx            # серверный: getSession() → redirect('/') залогиненного, иначе <LoginPage/>
│   │   └── register/page.tsx         # серверный: getSession() → redirect('/') залогиненного, иначе <RegisterPage/>
│   └── api/auth/                     # Route Handlers (BFF-прокси к Nest, ставят куку)
│       ├── login/route.ts
│       ├── register/route.ts
│       └── logout/route.ts
# middleware.ts/proxy.ts — упразднён: гард переехал в сами page.tsx (см. ниже «Обновление»)
├── views/
│   ├── login/{ui/LoginPage.tsx,index.ts}
│   └── register/{ui/RegisterPage.tsx,index.ts}
├── features/auth/
│   ├── login/{ui/LoginForm.tsx, model/use-login.ts, index.ts}
│   └── register/{ui/RegisterForm.tsx, model/use-register.ts, index.ts}
├── entities/session/
│   ├── model/session.server.ts       # getSession(): читает куку, зовёт Nest /me → UserDto|null (server-only)
│   ├── model/session-context.tsx     # SessionProvider + useSession() (client)
│   └── index.ts
└── shared/
    ├── ui/                           # shadcn: button, input, label, card, form (переезд из components/ui)
    ├── lib/utils.ts                  # cn (переезд из lib/utils.ts)
    ├── api/
    │   ├── nest.ts                   # серверный fetch к Nest (NEXT_PUBLIC_API_URL + /api), с Bearer
    │   └── expenses.ts               # перенос функций из старого lib/api.ts (не переписываем логику)
    └── config/cookie.ts              # имя куки "session", опции (httpOnly, sameSite, maxAge=7d, secure=prod)
```

## Зависимости и конфиги

1. **shadcn-компоненты**: `npx shadcn@latest add button input label card form`
   (в `apps/web`). Он подтянет `@radix-ui/react-slot`, `@radix-ui/react-label`,
   `react-hook-form`; `@hookform/resolvers` добавить явно, если CLI не поставит.
2. **`apps/web/components.json`** — перенастроить `aliases` под FSD:
   `ui → @/shared/ui`, `utils → @/shared/lib/utils`, `lib → @/shared/lib`,
   `components → @/shared`, `hooks → @/shared/lib/hooks`. После этого CLI кладёт
   компоненты сразу в `shared/ui`.
3. **`apps/web/src/app/globals.css`** — текущий набор токенов урезан; для Button/Input/
   Card/Form добавить недостающие shadcn-переменные «neutral» в `:root` и `.dark` и
   смапить их в `@theme inline`: `--popover(-foreground)`, `--secondary(-foreground)`,
   `--accent(-foreground)`, `--input`, `--ring` (значения — стандартные neutral-oklch
   shadcn; `--card` уже есть). Без них компоненты рендерятся с «пустыми» цветами.
4. **`tsconfig`/алиасы** не трогаем: `@/*→ ./src/*` уже покрывает `@/shared/*`.

## Реализация по слоям

**shared**
- Перенести `lib/utils.ts → shared/lib/utils.ts`, удалить старый `lib/utils.ts`
  (обновить импорты; сейчас `cn` ещё никем не используется).
- `shared/api/nest.ts` — на базе старого `request<T>` из `lib/api.ts`: `nestFetch(path, {token?})`,
  дергает `${NEXT_PUBLIC_API_URL}/api${path}`, ставит `Authorization: Bearer` при наличии
  токена, `cache: "no-store"`; **используется только на сервере** (Route Handlers, `session.server`).
- `shared/api/expenses.ts` — перенести функции из `lib/api.ts` как есть (переключение
  expenses с `?userId=` на Bearer — вне этой задачи; отметить TODO).
- `shared/config/cookie.ts` — `SESSION_COOKIE = "session"` и фабрика опций куки.
- Удалить старый `lib/api.ts` после переноса.

**entities/session**
- `session.server.ts`: `getSession()` — `cookies()` (next/headers) → токен → `nestFetch("/auth/me", {token})`;
  ошибка/нет куки → `null`. Server-only (`import "server-only"`).
- `session-context.tsx`: клиентский `SessionProvider` (хранит `user: UserDto | null`,
  начальное значение из сервера) + хук `useSession()`. Для показа «Выйти» и будущих экранов.

**app/api/auth (Route Handlers, BFF)**
- `register/route.ts`, `login/route.ts`: принимают JSON тела, зовут `nestFetch` на
  соответствующий Nest-эндпоинт. При успехе — `cookies().set(SESSION_COOKIE, accessToken, опции)`
  и возвращают `{ user }` со статусом Nest. При ошибке — пробрасывают статус и `message`
  Nest клиенту (401/409/400) без токена.
- `logout/route.ts`: `cookies().delete(SESSION_COOKIE)`, `200`.

**features/auth**
- `model/use-login.ts` / `use-register.ts`: `useForm` с `zodResolver(loginSchema/registerSchema)`,
  `defaultValues`; `onSubmit` → `fetch("/api/auth/login" | "/register", {POST, json})` (свой
  Route Handler, same-origin). Маппинг ошибок: register 409 → `setError("email", ...)`;
  login 401 → корневая ошибка формы (`setError("root", ...)`); 400 issues → по полям.
  При успехе — `router.push("/")` + `router.refresh()`.
- `ui/LoginForm.tsx` / `RegisterForm.tsx` (`"use client"`): shadcn `Form`/`FormField`/
  `FormItem`/`FormLabel`/`FormControl`/`FormMessage`, `Input`, `Button` (loading-состояние
  по `formState.isSubmitting`), вывод корневой ошибки.

**views**
- `LoginPage.tsx` / `RegisterPage.tsx`: центрированная `Card` с заголовком, форма-фича
  внутри и ссылка-переход на встречную страницу (`next/link`).

**app (маршруты)**
- `(auth)/login/page.tsx`, `(auth)/register/page.tsx` — импортируют соответствующий view.
- `layout.tsx` — читает `getSession()` на сервере, оборачивает `children` в `SessionProvider`
  с начальным `user`.
- `page.tsx` — оставить заглушку, добавить кнопку «Выйти» (клиентский компонент, дергает
  `/api/auth/logout` + `router.refresh()`), если `useSession()` не пуст.
- Редирект залогиненного с `/login`,`/register` на `/` — гард в самих серверных `page.tsx`
  (`if (await getSession()) redirect("/")`), НЕ в middleware/proxy. Причина см. «Обновление» ниже.
  (Защиту приватных маршрутов оставляем на будущее.)

## CLAUDE.md

Добавить раздел **«Feature-Sliced Design (фронтенд)»**:
- слои и правило импортов только вниз (`app → views → features → entities → shared`);
- адаптация под App Router: `src/app` — только маршруты и BFF Route Handlers; FSD-слой
  «pages» назван `views`; провайдеры сведены в корневой `layout.tsx`;
- где живёт shadcn — `shared/ui`, алиасы в `components.json` перенастроены на `@/shared/*`;
- **паттерн авторизации BFF**: форма → свой Route Handler `/api/auth/*` → Nest; токен в
  httpOnly-куке `session`, наружу в JS не отдаётся; `getSession()` (server-only) читает
  куку и валидирует через Nest `/auth/me`;
- заметка: expenses пока на `?userId=` — переключение на Bearer запланировано отдельно.

## Порядок реализации (по одной задаче за раз, с подтверждением)

1. Инфраструктура shared + shadcn: `components.json`, установка компонентов, перенос
   `lib/utils.ts → shared/lib`, дополнение `globals.css` токенами.
2. `shared/api/nest.ts`, `shared/api/expenses.ts`, `shared/config/cookie.ts`, удаление `lib/`.
3. `entities/session` (server + context).
4. Route Handlers `app/api/auth/{login,register,logout}`.
5. `features/auth/{login,register}` (формы + модель).
6. `views` + маршруты `app/(auth)/*` (с гардом `getSession()→redirect` в page.tsx) + `layout.tsx` + кнопка «Выйти».
7. Раздел FSD в `CLAUDE.md`.
8. Проверка (typecheck/lint/build + ручной прогон).

## Проверка

Предусловия: `docker compose up -d`, `npm run db:migrate`, в корневом `.env` задан
`JWT_SECRET` (пользователь добавляет вручную — API без него не стартует).

1. `npm run dev` → web :3000, api :3001.
2. `/register`: валидные данные → редирект на `/`, в devtools кука `session` httpOnly;
   повтор того же email → ошибка «Email уже занят» под полем email; короткий пароль
   (<8) / битый email → ошибки полей (клиентский zod).
3. `/logout` (кнопка «Выйти» на `/`) → кука снята, `useSession()` пуст.
4. `/login`: верные креды → редирект; неверные → корневая ошибка «Неверный email или пароль».
5. Залогинен и открыл `/login` → серверный гард в `page.tsx` редиректит на `/`.
6. `npm run typecheck`, `npm run lint`, `npm run build` в `apps/web`
   (сборку гнать с `NODE_ENV=production` — см. ловушку next build в CLAUDE.md).
7. Прогнать `/run` или `claude-in-chrome` для визуальной проверки страниц (light/dark).

## Обновление: гард входа переехал с middleware/proxy в page.tsx

Изначально редирект залогиненного со страниц входа делал `middleware.ts` (в Next 16
переименован в `proxy.ts`). От него **отказались** — файл удалён, гард живёт в серверных
`(auth)/login/page.tsx` и `(auth)/register/page.tsx` (`if (await getSession()) redirect("/")`).

Две причины:

1. **Корректность.** Middleware проверял лишь **наличие** куки (`cookies.has("session")`), а
   `getSession()`/`AuthStatus` — её **валидность** (запрос к Nest `/auth/me`). Протухшая кука
   (например, после смены `JWT_SECRET`) давала петлю: `getSession` рисует «Войти», клик ведёт на
   `/login`, middleware по факту наличия куки редиректит обратно на `/` — и так по кругу.
2. **Задержка.** Middleware выполняется вживую на **каждый** запрос (включая сам клик) и его
   результат не кешируется. Сетевой `fetch` к `/auth/me` внутри него блокировал навигацию.
   Гард в `page.tsx` едет вместе с RSC-prefetch, поэтому переход гостя мгновенный, а для гостя
   вовсе без куки `getSession` возвращает `null` сразу, без сетевого вызова.

Источник истины один — `getSession`. Проверять авторизацию по одному наличию куки нельзя.
Когда понадобится защита приватных маршрутов, вернём proxy/middleware отдельно — но с
**валидацией** токена, а не presence-check.

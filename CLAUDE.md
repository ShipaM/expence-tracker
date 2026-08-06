# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Файл описывает **только монорепо в целом**: корневые команды, архитектуру, общие пакеты
(`packages/db`, `packages/shared`), политику версий и соглашения. Всё, что специфично для
приложения, лежит в его собственном файле — читайте его перед работой с воркспейсом:

- **`apps/api/CLAUDE.md`** — NestJS: модули, CQRS-граница Users ↔ Auth, валидация, JWT,
  команды и тесты бэкенда
- **`apps/web/CLAUDE.md`** — Next.js: Feature-Sliced Design, BFF-авторизация, shadcn/ui,
  Tailwind, команды фронтенда

## Статус проекта

Каркас поднят и проверен: зависимости установлены, миграции применены, все скрипты во всех
`package.json` прогнаны и работают. Состояние приложений и цифры по тестам — в их файлах.

БД в контейнере пустая: таблицы созданы, данных нет. (Тестовые данные, которые могут
встретиться в истории, осели в локальном PostgreSQL на 5432 — см. «Порт БД».)

Если `packages/db/src/generated` отсутствует (свежий клон, `npm run clean`), типы из `@repo/db`
не резолвятся до `npm run db:generate` — это ожидаемо, а не ошибка в коде.

## Команды монорепо

Запускаются из корня; оркестрация — Turborepo.

```bash
npm install                 # первый запуск: установить зависимости всех воркспейсов
cp .env.example .env        # DATABASE_URL, порты, JWT_SECRET (замените плейсхолдер)
docker compose up -d        # PostgreSQL 18 на :5433 (не 5432 — см. ниже)

npm run db:generate         # Prisma Client → packages/db/src/generated
npm run db:migrate          # prisma migrate dev в packages/db
npm run db:studio           # Prisma Studio на :5555

npm run dev                 # все приложения параллельно
npm run build               # сборка всех воркспейсов
npm run typecheck           # tsc --noEmit
npm run lint
npm run clean               # удалить dist, .next, src/generated

npm test                    # юнит-тесты всех воркспейсов (Vitest), БД не нужна
npm run test:watch
npm run test:coverage       # покрытие (v8)
npm run test:e2e            # e2e (есть только у api — детали в apps/api/CLAUDE.md)
```

Один воркспейс: `npm run <script> --workspace @repo/<web|api|db|shared>`. Аргументы для
конкретного файла или кейса передавайте только так — из корня Turbo раздаст их всем задачам:

```bash
npm run <script> --workspace @repo/<name> -- <аргументы>
```

## Архитектура

```
apps/web         Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui   → :3000
apps/api         NestJS 11, глобальный префикс /api                          → :3001
packages/db      Prisma 7: схема, миграции, сгенерированный клиент (@repo/db)
packages/shared  zod-схемы + DTO, общие для фронта и бэка (@repo/shared)
```

Граф зависимостей: `web → shared`, `api → db, shared`. `shared` и `db` компилируются через
`tsc` в `dist/` и подключаются как обычные npm-пакеты, поэтому в `turbo.json` задача `dev`
зависит от `^build` — без этого воркспейсы-библиотеки не будут собраны к моменту старта.

## Замороженные версии — не поднимать

Три пакета намеренно НЕ на `latest`. Обновление любого из них ломает сборку молча или почти
молча — прежде чем поднимать, прочитайте причину (подробности — в файле того приложения,
которое ломается).

| Пакет            | Стоит  | В npm latest | Почему заморожен                                                                                             |
| ---------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------ |
| typescript       | 5.9.3  | 7.0.2        | NestJS 11 заявляет только `^5.7.3`; поддержка `emitDecoratorMetadata` в нативном tsgo не подтверждена         |
| eslint           | 9.39.5 | 10.x         | плагин, который тянет конфиг Next, под ESLint 10 падает — см. `apps/web/CLAUDE.md`                            |
| Vitest transform | swc    | Oxc (дефолт) | Oxc не поддерживает `emitDecoratorMetadata` — см. `apps/api/CLAUDE.md`                                        |

Общий знаменатель: экосистема декораторов (Nest) отстаёт от новых компиляторов.

## Порт БД: 5433, а не 5432

На хосте 5432 занимает локальная служба `postgresql-x64-18`. Windows разрешает Docker-прокси
занять уже слушающий порт **молча**: контейнер рапортует `0.0.0.0:5432->5432/tcp` и выглядит
здоровым, но подключения на `localhost:5432` уходят в локальную службу, а не в него.
Поэтому контейнер публикуется на 5433. Если данные «пропадают» или таблиц нет там, где
ожидаются, — сначала проверьте, к какому порту реально подключились.

## Prisma 7 (`packages/db`) — важные отличия от Prisma 6

Не применяйте здесь привычные паттерны Prisma 6, они сломаются:

1. **Строка подключения не в схеме.** `DATABASE_URL` задаётся в `packages/db/prisma.config.ts`
   через `env("DATABASE_URL")`; в блоке `datasource` схемы `url` отсутствует намеренно.
   `.env` лежит в корне монорепо, а prisma запускается из `packages/db`, поэтому путь к нему
   в `prisma.config.ts` задан явно — иначе `DATABASE_URL` не резолвится.
2. **Генератор `prisma-client`** (не устаревший `prisma-client-js`), поле `output` обязательно.
   Клиент генерируется в `packages/db/src/generated` и **не** попадает в `node_modules`;
   эта папка в `.gitignore` и пересоздаётся через `npm run db:generate`.
3. **Driver adapter обязателен.** `new PrismaClient()` без адаптера не стартует. Единственная
   точка создания клиента — `createPrismaClient()` в `packages/db/src/client.ts` (оборачивает
   `PrismaPg`).
4. **Граница ESM/CJS.** Prisma 7 — ESM-first, потребитель (`api`) — CommonJS. Поэтому в
   генераторе явно стоят `moduleFormat = "cjs"` и `importFileExtension = "js"`. Импорты внутри
   `packages/db` пишутся с расширением `.js` (`./generated/client.js`), хотя файлы — `.ts`.

## Тесты

Vitest 4. Юнит-тесты — `*.spec.ts` рядом с кодом (`apps/api` — сервисы, `packages/shared` —
zod-схемы), БД для них не нужна. E2E — только у API, с реальной базой; конфиги, тестовая БД и
секрет описаны в `apps/api/CLAUDE.md`. Тестов для `web` пока нет.

## ESLint

Конфиги flat, у каждого приложения свой (`apps/web/eslint.config.mjs`,
`apps/api/eslint.config.mjs`) — содержимое описано в файлах приложений. `packages/*` линтом
не покрыты.

Если после смены версий появляются странные ошибки правил, проверьте `npm ls eslint`: npm любит
оставлять в воркспейсе старую копию с пометкой `invalid`, и инкрементальный `npm install` её не
чинит. Лечится полной переустановкой (`rm -rf node_modules package-lock.json && npm install`).

## Общие конвенции

- **Валидация — zod по умолчанию.** Схемы живут в `packages/shared/src/index.ts` и
  переиспользуются обоими приложениями (в Nest — через `ZodValidationPipe`, на фронте — через
  `zodResolver`). Есть осознанное исключение на бэкенде — см. `apps/api/CLAUDE.md`.
- **Денежные суммы — строки.** В БД это `Decimal(12,2)`, через API ходят строками
  (`amount.toFixed(2)`): JSON-число теряет точность на копейках. Не приводите к `number`
  ни на бэкенде, ни на фронте.

## Работа с ветками (GitHub Flow)

Модель — **GitHub Flow**: `master` всегда в рабочем, деплоимом состоянии; прямых коммитов в
`master` нет. Любая работа идёт в отдельной ветке от свежего `master` и вливается обратно
через Pull Request после ревью.

- **Именование:** `<тип>/<краткое-описание-через-дефис>`, где тип совпадает с Conventional
  Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `ci`). Пример текущей ветки —
  `feature/main-screen`. Описание на английском (кроме уже заведённой ветки), в kebab-case.
- **Старт фичи:** ветвиться от актуального `master`:
  ```bash
  git checkout master && git pull
  git checkout -b feat/<название>
  ```
- **Ветка живёт недолго и решает одну задачу.** Регулярно подтягивай `master`, чтобы
  расхождение не копилось.
- **Вливание — только через PR.** Прямой merge/push в `master` не делаем; PR проходит ревью,
  зелёные проверки (`typecheck`, `lint`, тесты), затем squash-merge. После слияния ветку удаляем.
- Коммиты внутри ветки — по [соглашению о коммитах](#соглашение-о-коммитах) ниже.

## Pull Request

PR — единственный способ попасть в `master`. Перед созданием прогони локально то, что
проверяет ревью: `npm run typecheck`, `npm run lint`, `npm test` (и `npm run test:e2e`,
если трогал API — нужен поднятый контейнер).

**Заголовок — по Conventional Commits**, как коммит: `<тип>(<scope>): <описание на английском>`.
Если в ветке есть breaking change (напр. изменился формат ответа эндпоинта) — восклицательный
знак в заголовке PR: `feat(api)!: ...`. Scope у сборной ветки — область целиком (`web`, `api`)
или несколько через запятую.

**Описание — на английском, по структуре** (заголовки секций и текст — на английском):

```markdown
## Summary

<2–3 sentences: what task the branch solves>

## API

<new/changed endpoints: method, path, params, response shape; if API untouched — drop the section>

## Frontend

<new pages/FSD slices and what they do; if untouched — drop the section>

## Breaking changes

<what breaks for consumers and what they must fix; if none — drop the section>

## Testing

<which commands were run and with what result>
```

Смотри `git diff master...HEAD` (три точки — только изменения ветки, без ушедшего вперёд
`master`), а не `git diff master`.

**Создание — через `gh`.** В PATH Git Bash его нет, вызывай по полному пути; тело передавай
файлом, а не `--body` со строкой (иначе многострочный markdown ломается в PowerShell):

```bash
git push -u origin <branch>
"/c/Program Files/GitHub CLI/gh.exe" pr create --base master --head <branch> \
  --title "feat(scope): ..." --body-file <файл в скретчпаде>
```

Мержится PR squash-мержем после зелёных проверок и ревью; ветка после слияния удаляется.

## Соглашение о коммитах

Используй Conventional Commits:

- Тип: feat, fix, docs, refactor, test, ci
- Область (scope): модуль или область изменений
- Описание на английском, кратко — одно предложение
- Breaking changes помечай восклицательным знаком
- **Без футеров и упоминаний Claude/Co-Authored-By.** Сообщение коммита — только
  заголовок Conventional Commits (при необходимости тело); строку
  «🤖 Generated with Claude Code» и подобные не добавляй.

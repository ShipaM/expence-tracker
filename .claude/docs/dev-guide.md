# Руководство разработчика

Пошаговые рецепты: новый модуль бэкенда, новая фича фронтенда, новая миграция. Устройство
проекта — в `architecture.md`, схема БД — в `database.md`, эндпоинты — в `api.md`.

## Перед началом

```bash
git checkout master && git pull
git checkout -b feat/<название-через-дефис>
```

Ветка от свежего `master`, тип совпадает с Conventional Commits (`feat`, `fix`, `docs`,
`refactor`, `test`, `ci`), описание на английском в kebab-case. Прямых коммитов в `master` нет.

---

## Как добавить модуль бэкенда

Пример: модуль `budgets`.

### 1. Схема БД

Опишите модель в `packages/db/prisma/schema.prisma` и примените миграцию (см. раздел про
миграции ниже). Не забудьте `@@map` на snake_case и связь с `User` через `onDelete: Cascade`.

### 2. DTO

`apps/api/src/budgets/dto/create-budget.dto.ts` — class-validator плюс Swagger:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

/** Тело `POST /api/budgets`. Проверяется глобальным ValidationPipe. */
export class CreateBudgetDto {
  /** Название бюджета, 1–60 символов. */
  @ApiProperty({ minLength: 1, maxLength: 60, example: "Отпуск" })
  @IsString()
  @Length(1, 60)
  name!: string;
}
```

Для новых модулей вообще-то предпочтителен zod (схема в `@repo/shared` +
`@Body(new ZodValidationPipe(schema))`) — class-validator в `transactions`/`categories` это
осознанное отступление. Выбирайте zod, если нет причин повторять соседей.

Отдельно заведите класс схемы ответа, если эндпоинт что-то возвращает: Swagger читает
метаданные только с классов, а типы ответов в `@repo/shared` — интерфейсы.

```ts
export class BudgetResponseDto implements BudgetDto {
  @ApiProperty({ format: "uuid" })
  id!: string;
}
```

`implements` обязателен — иначе схема тихо разойдётся с контрактом.

### 3. Сервис

`budgets.service.ts`. Правила, которые нельзя нарушать:

- каждый запрос к БД фильтруется по `userId`;
- перед созданием записи — `GetUserByIdQuery` через `QueryBus` (токен мог пережить удаление
  аккаунта), нет пользователя → `UnauthorizedException`;
- чужая запись = `NotFoundException`, а не 403;
- `Decimal` наружу — строкой через `toFixed(2)`;
- JSDoc на каждый метод: описание, `@param`, `@returns`, `@throws`.

```ts
@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBus: QueryBus,
  ) {}
}
```

### 4. Контроллер

```ts
@ApiTags("budgets")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Токен отсутствует, истёк или неверен" })
@Controller("budgets")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  @ApiOperation({ summary: "Список бюджетов" })
  @ApiResponse({ status: 200, type: [BudgetResponseDto] })
  @Get()
  findAll(@CurrentUser() userId: string): Promise<BudgetDto[]> {
    return this.budgets.findAll(userId);
  }
}
```

Обязательно: `@UseGuards(JwtAuthGuard)` на классе, `userId` через `@CurrentUser()`,
`ParseUUIDPipe` на `:id` в пути, `@ApiTags`/`@ApiOperation`/`@ApiResponse` на каждом методе.
Маршруты-слова (`/summary`) объявляйте **до** `/:id`, иначе `ParseUUIDPipe` их перехватит.

### 5. Модуль

```ts
// AuthModule → JwtAuthGuard; CqrsModule → QueryBus (диспетч GetUserByIdQuery в Users).
@Module({
  imports: [AuthModule, CqrsModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
```

`UsersModule` не импортируется — хэндлеры регистрируются глобально через `CqrsModule`.
`PrismaModule` тоже не нужен, он глобальный.

### 6. Регистрация и тесты

Добавьте `BudgetsModule` в `imports` корневого `app.module.ts`. Затем:

- юнит-тест `budgets.service.spec.ts` рядом с кодом, `PrismaService` мокается структурой
  `{ client: { budget: {...} } }`, суммы — реальным `Prisma.Decimal`;
- e2e `apps/api/test/budgets.e2e-spec.ts`: токены получаются настоящей регистрацией через
  `POST /api/auth/register`, а не подделываются; бутстрап должен повторять `main.ts`
  (`setGlobalPrefix("api")` + тот же `ValidationPipe`), иначе тестируется не то приложение.

### 7. Проверка

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e            # нужен поднятый контейнер БД
```

---

## Как добавить фичу фронтенда

Фронтенд на Feature-Sliced Design: импорт только вниз по слоям
(`app → views → widgets → features → entities → shared`).

### 1. Выберите слой

| Что делаете | Слой |
|---|---|
| новый маршрут | `app/` — только тонкая обёртка, делегирует в `views` |
| композиция страницы | `views/<name>/ui/<Name>Page.tsx` |
| самостоятельный блок из фич и сущностей | `widgets/<name>/` |
| пользовательский сценарий (форма, действие) | `features/<domain>/<action>/` |
| бизнес-сущность и доступ к её данным | `entities/<name>/` |
| переиспользуемое без домена | `shared/` |

### 2. Соберите слайс

```
features/transaction/create/
  index.ts                 публичный API слайса — только он виден снаружи
  ui/CreateTransactionForm.tsx
  model/use-create-transaction.ts
```

Форма — `react-hook-form` + `zodResolver` со схемой из `@repo/shared`, чтобы фронт и бэк
валидировали одно и то же.

### 3. Данные

Серверные модули помечайте `import "server-only"` и **не** реэкспортируйте через клиентский
`index.ts` — для серверного входа заводите отдельный `server.ts` (как у `entities/session`).
Запросы к Nest идут через `shared/api/nest.ts` (`nestFetch`/`nestJson`), тоже только на сервере.

Если действие инициирует браузер и нужен токен — добавьте BFF Route Handler в
`app/api/.../route.ts`: он читает httpOnly-куку `session` и ходит в Nest. Клиент JWT не видит
никогда.

### 4. UI

Компоненты shadcn ставятся из `apps/web`:

```bash
npx shadcn@latest add <component>     # положит в src/shared/ui
```

Tailwind 4 без `tailwind.config.js` — тема и токены в `src/app/globals.css` (`@theme inline`).

Денежные суммы приходят строками, к `number` для расчётов их не приводите.

### 5. Проверка

```bash
npm run typecheck --workspace @repo/web
npm run lint --workspace @repo/web
npm run test --workspace @repo/web
npm run dev --workspace @repo/web
```

Компонентные тесты — Vitest + Testing Library в окружении `jsdom`, файл `*.spec.tsx` рядом
с компонентом. Образец — `src/shared/ui/button.spec.tsx`.

---

## Как добавить миграцию

### Обычный поток

1. Отредактируйте `packages/db/prisma/schema.prisma`.
2. Создайте миграцию с осмысленным именем:

```bash
npm run db:migrate --workspace @repo/db -- --name add_budgets
```

Именно так, с явным `--workspace @repo/db`. Корневой `npm run db:migrate` без имени работает,
но `-- --name <имя>` до Prisma не доезжает: аргумент теряется по пути через вложенный
npm-скрипт (а если звать через Turbo — раздаётся всем задачам сразу). Безымянная миграция
получит автосгенерированное имя, и в истории останется невнятный каталог.

3. Клиент перегенерируется автоматически; если типы не подхватились:

```bash
npm run db:generate
```

4. Проверьте результат — `npm run db:studio` (Prisma Studio на :5555) или `npm run typecheck`.

### Что попадает в коммит

Файл миграции из `packages/db/prisma/migrations/<timestamp>_<name>/` — **обязательно**.
`packages/db/src/generated/` в git не хранится.

### Частые грабли

| Симптом | Причина |
|---|---|
| `DATABASE_URL не задан` | `.env` не скопирован из `.env.example`, либо запуск не из корня |
| таблиц нет там, где ожидаются | подключились к 5432 (локальная служба) вместо 5433 |
| типы из `@repo/db` не резолвятся | не выполнен `npm run db:generate` после клона/`clean` |
| миграция не применяется | контейнер не поднят: `docker compose up -d` |

### Правка уже применённой миграции

Локально проще откатить базу целиком, чем чинить историю:

```bash
docker compose down -v      # удалит том вместе с данными
docker compose up -d
npm run db:migrate
```

Это допустимо только на локальной базе — данных в ней нет по определению.

---

## Перед Pull Request

Прогоните то же, что проверяет ревью:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e            # если трогали apps/api
```

Заголовок PR — по Conventional Commits: `<тип>(<scope>): <описание на английском>`, breaking
change помечается `!`. Описание — на английском, по шаблону из корневого `CLAUDE.md`
(Summary / API / Frontend / Breaking changes / Testing). Смотрите `git diff master...HEAD` —
три точки, только изменения ветки.

Создание через `gh` (в PATH Git Bash его нет, нужен полный путь), тело — файлом, не строкой:

```bash
git push -u origin <branch>
"/c/Program Files/GitHub CLI/gh.exe" pr create --base master --head <branch> \
  --title "feat(api): ..." --body-file <файл>
```

Мержится squash-мержем после зелёных проверок и ревью; ветка удаляется.

## Коммиты

Conventional Commits: тип (`feat`, `fix`, `docs`, `refactor`, `test`, `ci`), scope — модуль или
область, описание на английском одним предложением. Без футеров и упоминаний Claude /
Co-Authored-By.

## Что нельзя ломать

| Правило | Почему |
|---|---|
| TypeScript 5.9, ESLint 9.39.5, swc в Vitest | экосистема декораторов Nest отстаёт от новых компиляторов |
| `experimentalDecorators` + `emitDecoratorMetadata` в `apps/api/tsconfig.json` | без них Nest теряет типы конструкторов и DI перестаёт работать |
| `oxc: false` + `unplugin-swc` в обоих конфигах Vitest | Oxc не поддерживает `emitDecoratorMetadata`, DI молча ломается |
| фильтр по `userId` в каждом запросе | на нём держится изоляция пользователей |
| суммы строками | JSON-число теряет копейки |
| `JWT_SECRET` в `.env` | без него `api` падает на старте |

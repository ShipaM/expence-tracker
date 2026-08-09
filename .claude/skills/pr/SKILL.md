---
name: pr
description: Создать Pull Request на GitHub с заголовком по Conventional Commits и описанием по шаблону проекта
user_invocable: true
disable-model-invocation: true
allowedTools:
  - Bash(git *)
  - Bash(/c/Program Files/GitHub CLI/gh.exe *)
  - Bash(npm run *)
  - Write
model: claude-sonnet-4-5
effort: medium
---

## Что делает

Готовит и создаёт PR в `master`: прогоняет проверки, пушит ветку, собирает описание по шаблону
проекта из `CLAUDE.md` и вызывает `gh pr create`. Вызывается вручную: `/pr`.

## Аргументы

```
/pr "<title>" [<branch>]
```

| Аргумент  | Обязателен | Смысл                                                                |
| --------- | ---------- | -------------------------------------------------------------------- |
| `title`   | нет        | заголовок PR; если не задан — вывести из коммитов ветки              |
| `branch`  | нет        | ветка-источник; если не задана — текущая (`git branch --show-current`) |

Примеры:

```
/pr "feat(web): add password visibility toggle"
/pr "fix(api): correct transactions pagination" fix/transactions-pagination
/pr
```

Если `branch` задана и отличается от текущей — **не переключаться на неё**, а работать с ней
через явные ref'ы (`master...<branch>`). Переключение ветки может затереть незакоммиченную работу.

## Заголовок

Conventional Commits, как у коммита: `<тип>(<scope>): <описание на английском>`.

- Типы: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`
- Scope: `backend`, `frontend`, `shared`, `config`; у сборной ветки — область целиком
  (`web`, `api`) или несколько через запятую
- Breaking change в ветке → восклицательный знак: `feat(api)!: ...`

Если заголовок не передан — сформировать его из коммитов ветки (`git log master..<branch>`),
взяв преобладающий тип и общую суть, и **показать пользователю перед созданием PR**.

## Алгоритм выполнения

1. **Определить ветку и проверить, что PR вообще нужен:**

   ```bash
   BRANCH=${1:-$(git branch --show-current)}
   git log --oneline master..$BRANCH        # пусто → нечего вливать, остановиться
   git status --short                        # незакоммиченное — предупредить пользователя
   ```

   Ветка не должна быть `master`: прямой PR из `master` в `master` невозможен, а работа в
   `master` запрещена (GitHub Flow, см. `CLAUDE.md`). Если оказались в `master` — остановиться
   и сказать об этом, ветку за пользователя не создавать.

2. **Подтянуть свежий `master`,** чтобы не собирать описание по устаревшей базе:

   ```bash
   git fetch origin master
   ```

   Если ветка сильно разошлась — сказать пользователю, но `rebase`/`merge` самостоятельно не делать.

3. **Прогнать проверки** (то же, что смотрит ревью):

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run test:e2e     # только если менялся apps/api; нужен поднятый контейнер БД
   ```

   Красные проверки — не создавать PR молча: показать вывод и спросить, продолжать ли.
   Результаты понадобятся для секции `## Testing`.

4. **Разобрать изменения ветки** — три точки, только коммиты ветки, без ушедшего вперёд `master`:

   ```bash
   git diff master...$BRANCH --stat
   git log master..$BRANCH --oneline
   git diff master...$BRANCH -- <важные файлы>
   ```

   Смотреть: новые/изменённые эндпоинты, миграции и схему Prisma, новые слайсы FSD, изменения
   контрактов в `packages/shared`, breaking changes.

5. **Запушить ветку:**

   ```bash
   git push -u origin $BRANCH
   ```

6. **Написать тело PR в файл** (в скретчпад-директорию сессии, не в репозиторий) — многострочный
   markdown через `--body` ломается в PowerShell, поэтому только `--body-file`.

7. **Создать PR** — `gh` нет в PATH Git Bash, вызывать по полному пути:

   ```bash
   "/c/Program Files/GitHub CLI/gh.exe" pr create --base master --head "$BRANCH" \
     --title "<title>" --body-file <файл>
   ```

8. **Вывести ссылку** на созданный PR и краткую сводку: заголовок, ветка, число коммитов,
   результат проверок.

## Шаблон описания

Английский, секции — как в `CLAUDE.md`. Неприменимые секции **удалять целиком**, а не оставлять
пустыми или с «N/A».

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

## Запрещено

- Не пушить в `master` и не создавать PR из `master`.
- Не мержить PR самостоятельно — мерж делает ревьюер squash-мержем.
- Не использовать `git push --force` и не переписывать историю ветки.
- Не переключать ветки и не трогать рабочее дерево пользователя (`checkout`, `stash`, `reset`).
- Не писать в секцию `## Testing` команды, которые не запускались, и не выдумывать их результат.
- Без футеров и упоминаний Claude в заголовке PR (в теле допускается только строка
  «🤖 Generated with [Claude Code](https://claude.ai/code)», если пользователь её просит).

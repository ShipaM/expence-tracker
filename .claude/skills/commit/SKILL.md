---
name: commit
description: Создать коммит по соглашению проекта с описанием на английском
allowedTools:
  - Bash(git *)
model: claude-sonnet-4-5
effort: low
---

## Правила коммитов

Типы: feat, fix, docs, refactor, test, ci
Scope: backend, frontend, shared, config
Описание: кратко на английском, в настоящем времени

## Примеры

feat(backend): add transactions
fix(frontend): fix validation form for login

## Алгоритм выполнения

1. git status — посмотреть изменения
2. git diff — проверить контент для сообщения
3. Определить type и scope
4. git add — добавить только нужные файлы (не git add .)
5. Сформировать сообщение по правилам
6. git commit через heredoc
7. Проверить результат

## Запрещено

- Никогда не пушить автоматически
- Не использовать --no-verify или --amend без явной просьбы
- Не добавлять файлы без понимания их содержимого

#!/usr/bin/env bash
# PreToolUse-хук для Edit|Write: запрещает править защищённые файлы.
#
# Путь приходит в JSON на stdin (.tool_input.file_path). Разбираем его через
# node, а не jq: jq в этом окружении не установлен.
#
# exit 2 = заблокировать вызов инструмента, текст из stderr уходит обратно
# в Claude как объяснение. Любой другой ненулевой код блокировкой НЕ является —
# Claude Code покажет ошибку хука и выполнит правку, поэтому падать здесь нельзя.
set -u

FILE_PATH=$(node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path||'')}catch{}})")
[ -n "$FILE_PATH" ] || exit 0

# Путь приходит в windows-виде (C:\...\packages\db\prisma\migrations\...).
# Без нормализации паттерны с прямым слэшем не совпадут никогда.
FILE_PATH=${FILE_PATH//\\//}

# Список защищённых паттернов (совпадение по подстроке нормализованного пути)
PROTECTED_PATTERNS=(".env" "prisma/migrations/" "package-lock.json")

# .env.example — не секрет, а шаблон в репозитории (CLAUDE.md велит копировать
# его в .env), и его правят при добавлении новой переменной. Из-под защиты выводим.
if [ "${FILE_PATH##*/}" != ".env.example" ]; then
  for PATTERN in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILE_PATH" == *"$PATTERN"* ]]; then
      echo "Заблокировано: $FILE_PATH является защищённым файлом." >&2
      echo "Правьте его вручную в терминале." >&2
      exit 2
    fi
  done
fi

exit 0

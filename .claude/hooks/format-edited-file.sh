#!/usr/bin/env bash
# PostToolUse-хук для Edit|Write: форматирует изменённый файл prettier'ом и,
# если это код из apps/web или apps/api, доводит его `eslint --fix`.
#
# Путь к файлу приходит в JSON на stdin (.tool_input.file_path). Разбираем его
# через node, а не jq: jq в этом окружении не установлен.
#
# Хук никогда не блокирует работу — при любой ошибке инструментов выходим с 0.
set -u

root=${CLAUDE_PROJECT_DIR:-$PWD}

# Локальные бинарники вместо npx: тот добавляет ~1 с на каждый запуск.
if [ -x "$root/node_modules/.bin/prettier" ]; then
  prettier=("$root/node_modules/.bin/prettier")
else
  prettier=(npx prettier)
fi

if [ -x "$root/node_modules/.bin/eslint" ]; then
  eslint=("$root/node_modules/.bin/eslint")
else
  eslint=(npx eslint)
fi

file=$(node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path||'')}catch{}})")
[ -n "$file" ] || exit 0

# --ignore-unknown: молча пропускает расширения, которых prettier не знает.
"${prettier[@]}" --write --ignore-unknown "$file" >/dev/null 2>&1

# Дальше только линт — расширения, которые покрыты eslint-конфигами.
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs) ;;
  *) exit 0 ;;
esac

# Конфиги flat и лежат в приложениях, поэтому eslint нужно запускать из каталога
# воркспейса; packages/* линтом не покрыты. `?` в шаблоне матчит и слэш, и
# обратный слэш — путь приходит в виде C:\...\apps\web\...
case "$file" in
  *apps?web?*) workspace=apps/web ;;
  *apps?api?*) workspace=apps/api ;;
  *) exit 0 ;;
esac

cd "$root/$workspace" && "${eslint[@]}" --fix "$file" >/dev/null 2>&1
exit 0

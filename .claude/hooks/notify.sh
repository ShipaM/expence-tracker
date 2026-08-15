#!/usr/bin/env bash
# Notification-хук: показывает системное уведомление, когда Claude Code ждёт
# ввода (запрос разрешения, вопрос, длительное бездействие).
#
# Текст уведомления приходит в JSON на stdin (.message) — берём его, а не
# захардкоженную строку, иначе «ждёт ввода» покажется и там, где Claude на
# самом деле просит подтвердить конкретную команду.
#
# Хук ничего не блокирует — выходим с 0 при любом раскладе.
set -u

msg=$(node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).message||'')}catch{}})")
[ -n "$msg" ] || msg="Claude ждёт вашего ввода"

# Кавычки ломают однострочник osascript — заменяем на одинарные.
msg=${msg//\"/\'}

if command -v osascript >/dev/null 2>&1; then
  # macOS
  osascript -e "display notification \"$msg\" with title \"Claude Code\"" >/dev/null 2>&1
elif command -v notify-send >/dev/null 2>&1; then
  # Linux
  notify-send "Claude Code" "$msg" >/dev/null 2>&1
elif command -v powershell.exe >/dev/null 2>&1; then
  # Windows. Текст передаём переменной окружения, а не подстановкой в строку
  # команды: в сообщении бывают кавычки и апострофы, экранировать их вручную —
  # лишний источник поломок. Балун живёт, пока жив процесс, отсюда Start-Sleep.
  CLAUDE_NOTIFY_MSG="$msg" powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command '
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.Visible = $true
    $n.ShowBalloonTip(5000, "Claude Code", $env:CLAUDE_NOTIFY_MSG, [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 3
    $n.Dispose()
  ' >/dev/null 2>&1
fi

exit 0

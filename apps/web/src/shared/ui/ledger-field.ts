/**
 * Разметка поля в стиле книги учёта: подпись — как заголовок колонки, само поле —
 * линованная строка, без рамки.
 *
 * Это классы для вызова, а не правки компонентов из `shared/ui`: базовые строки классов
 * `Input`, `Label` и `Button` покрыты тестами, поэтому оформление накладывается сверху
 * через `className`, а конфликты снимает `twMerge` внутри `cn`.
 */

/** Подпись поля: мелкий моношрифт в разрядку, как шапка колонки в гроссбухе. */
export const LEDGER_LABEL = "font-mono text-[0.625rem] tracking-[0.18em] text-ink/50 uppercase";

/**
 * Поле ввода: подчёркнутая строка вместо рамки; на фокусе линия наливается чернилами.
 *
 * Красную линию при ошибке рисует базовый `aria-invalid:border-destructive` самого
 * `Input` — токен `--destructive` указывает на ту же краску, что и `--debit`.
 */
export const LEDGER_INPUT = [
  "h-11 rounded-none border-0 border-b border-rule bg-transparent px-0 shadow-none",
  "focus-visible:border-b-2 focus-visible:border-b-ink focus-visible:ring-2 focus-visible:ring-ink/15",
].join(" ");

/** Основное действие листа: широкая плашка чернильного цвета. */
export const LEDGER_SUBMIT =
  "h-11 w-full rounded-none font-mono text-[0.6875rem] tracking-[0.2em] uppercase";

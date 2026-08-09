import { cn } from "@/shared/lib/utils";

/** Состояние одного поля формы, отражённое сегментом линии. */
export type BalanceSegment = "empty" | "valid" | "error";

const SEGMENT_TONE: Record<BalanceSegment, string> = {
  empty: "bg-rule",
  valid: "bg-ink",
  error: "bg-debit",
};

/**
 * Балансовая линия в левой марже формы: по сегменту на поле.
 *
 * Сегмент заливается чернилами, когда поле заполнено верно, и краснеет при ошибке.
 * Когда сходятся все — линия целиком уходит в зелёный и рядом проступает «сведено»,
 * бухгалтерский термин для сошедшегося баланса.
 *
 * Декоративна: то же состояние доступно скринридеру через `FormMessage` и `aria-invalid`
 * самих полей, поэтому линия скрыта от дерева доступности, чтобы не дублировать озвучку.
 */
export function BalanceRule({ segments }: { segments: BalanceSegment[] }) {
  const balanced = segments.length > 0 && segments.every((segment) => segment === "valid");

  return (
    <div aria-hidden="true" className="flex h-full flex-col items-center gap-2">
      <div className="ledger-draw flex w-[2px] flex-1 flex-col gap-1.5">
        {segments.map((segment, index) => (
          <span
            key={index}
            className={cn(
              "flex-1 rounded-full transition-colors duration-500",
              balanced ? "bg-credit" : SEGMENT_TONE[segment],
            )}
          />
        ))}
      </div>

      <span
        className={cn(
          "rotate-180 font-mono text-[9px] tracking-[0.25em] text-credit uppercase transition-opacity duration-500 [writing-mode:vertical-rl]",
          balanced ? "opacity-100" : "opacity-0",
        )}
      >
        сведено
      </span>
    </div>
  );
}

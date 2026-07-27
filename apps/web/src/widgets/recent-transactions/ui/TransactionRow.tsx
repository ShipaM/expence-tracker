import type { TransactionDto } from "@repo/shared";

import { formatAmount, formatDate } from "@/entities/transaction";
import { cn } from "@/shared/lib/utils";

/** Одна строка списка: слева — категория и описание, справа — сумма (цвет по типу) и дата. */
export function TransactionRow({ transaction }: { transaction: TransactionDto }) {
  const isExpense = transaction.type === "EXPENSE";

  return (
    <li className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{transaction.category.name}</p>
        {transaction.description && (
          <p className="truncate text-sm text-muted-foreground">{transaction.description}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-medium tabular-nums",
            isExpense ? "text-destructive" : "text-emerald-600",
          )}
        >
          {formatAmount(transaction.amount, transaction.type)}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(transaction.date)}</p>
      </div>
    </li>
  );
}

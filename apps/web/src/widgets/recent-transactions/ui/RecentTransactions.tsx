import { getTransactions } from "@/entities/transaction/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

import { Pagination } from "./Pagination";
import { TransactionRow } from "./TransactionRow";

const PAGE_SIZE = 10;

/** Серверный виджет: последние транзакции текущей страницы + пагинатор. */
export async function RecentTransactions({ page }: { page: number }) {
  const { items, total, page: current, limit } = await getTransactions({
    page,
    limit: PAGE_SIZE,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние транзакции</CardTitle>
        <CardDescription>Всего: {total}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Транзакций пока нет.</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        )}

        {total > limit && <Pagination page={current} total={total} limit={limit} />}
      </CardContent>
    </Card>
  );
}

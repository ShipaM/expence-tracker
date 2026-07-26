import Link from "next/link";

import { Button } from "@/shared/ui/button";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
}

/**
 * Пагинатор на ссылках (`/?page=N`): экран серверный и перефетчит страницу сам,
 * поэтому клиентский стейт не нужен. На границах кнопка — обычный disabled Button.
 */
export function Pagination({ page, total, limit }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-3">
      {hasPrev ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/?page=${page - 1}`}>Назад</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Назад
        </Button>
      )}

      <span className="text-sm text-muted-foreground">
        Страница {page} из {totalPages}
      </span>

      {hasNext ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/?page=${page + 1}`}>Вперёд</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Вперёд
        </Button>
      )}
    </div>
  );
}

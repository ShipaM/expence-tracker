import Link from "next/link";

import { Button } from "@/shared/ui/button";

/**
 * Меню-навигация к основным разделам. Сами страницы /transactions и /categories
 * появятся отдельными задачами — пока это только ссылки (переход даст 404).
 */
export function MainMenu() {
  return (
    <nav className="flex gap-3">
      <Button asChild>
        <Link href="/transactions">Транзакции</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/categories">Категории</Link>
      </Button>
    </nav>
  );
}

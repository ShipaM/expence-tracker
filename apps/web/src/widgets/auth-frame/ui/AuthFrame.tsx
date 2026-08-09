import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

const TABS = [
  { key: "login", href: "/login", label: "Вход" },
  { key: "register", href: "/register", label: "Регистрация" },
] as const;

type AuthTab = (typeof TABS)[number]["key"];

/** Заголовок страницы для скринридера: на экране его роль играют вкладки. */
const HEADINGS: Record<AuthTab, string> = {
  login: "Вход в трекер расходов",
  register: "Регистрация в трекере расходов",
};

const TAB_BASE =
  "flex h-12 items-center justify-center border-b border-rule font-mono text-[0.6875rem] tracking-[0.2em] uppercase transition-colors";

/**
 * Лист книги учёта, на котором лежат формы входа и регистрации.
 *
 * Вкладки сверху — не декоративный переключатель: вход и регистрация это два разворота
 * одного листа, и переход между ними единственный, поэтому дублирующая ссылка внизу
 * формы не нужна.
 */
export function AuthFrame({ active, children }: { active: AuthTab; children: ReactNode }) {
  return (
    <main className="paper-grid flex min-h-screen flex-col items-center justify-center gap-7 px-5 py-14">
      <h1 className="sr-only">{HEADINGS[active]}</h1>

      <p className="font-display text-[0.7rem] tracking-[0.45em] text-ink/55 uppercase">
        Трекер расходов
      </p>

      <section className="ledger-rise w-full max-w-104 border border-rule bg-sheet shadow-[0_20px_44px_-34px_rgba(22,32,43,0.55)]">
        <nav className="grid grid-cols-2">
          {TABS.map((tab) =>
            tab.key === active ? (
              <span
                key={tab.key}
                aria-current="page"
                className={cn(TAB_BASE, "border-t-2 border-t-ink text-ink")}
              >
                {tab.label}
              </span>
            ) : (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  TAB_BASE,
                  "bg-ink/6 text-ink/45 hover:bg-ink/10 hover:text-ink",
                  "focus-visible:z-10 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink",
                )}
              >
                {tab.label}
              </Link>
            ),
          )}
        </nav>

        <div className="px-6 py-7 sm:px-8">{children}</div>
      </section>
    </main>
  );
}

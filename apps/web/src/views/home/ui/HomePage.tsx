import { MainMenu } from "@/widgets/main-menu";
import { RecentTransactions } from "@/widgets/recent-transactions";
import { UserProfile } from "@/widgets/user-profile";

/** Композиция главного экрана: профиль + меню + последние транзакции. */
export function HomePage({ page }: { page: number }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Трекер расходов</h1>
      <UserProfile />
      <MainMenu />
      <RecentTransactions page={page} />
    </main>
  );
}

import Link from "next/link";

import { LoginForm } from "@/features/auth/login";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Вход</CardTitle>
          <CardDescription>Войдите в аккаунт трекера расходов</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <LoginForm />
          <p className="text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <Link
              href="/register"
              className="text-foreground underline underline-offset-4"
            >
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

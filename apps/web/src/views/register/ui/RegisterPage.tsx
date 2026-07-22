import Link from "next/link";

import { RegisterForm } from "@/features/auth/register";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>Создайте аккаунт трекера расходов</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <RegisterForm />
          <p className="text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link
              href="/login"
              className="text-foreground underline underline-offset-4"
            >
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

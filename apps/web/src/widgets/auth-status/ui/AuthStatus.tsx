"use client";

import Link from "next/link";

import { useSession } from "@/entities/session";
import { LogoutButton } from "@/features/auth/logout";
import { Button } from "@/shared/ui/button";

/** Композиция сессии и logout: гостю — ссылки входа/регистрации, юзеру — привет + выход. */
export function AuthStatus() {
  const user = useSession();

  if (!user) {
    return (
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Войти</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/register">Регистрация</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">Вы вошли как {user.name ?? user.email}</span>
      <LogoutButton />
    </div>
  );
}

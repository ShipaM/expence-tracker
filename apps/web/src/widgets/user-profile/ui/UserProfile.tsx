"use client";

import { useSession } from "@/entities/session";
import { LogoutButton } from "@/features/auth/logout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

/** Карточка профиля: имя (или email как фолбэк, т.к. name nullable) + выход. */
export function UserProfile() {
  const user = useSession();
  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Профиль</CardDescription>
        <CardTitle className="text-xl">{user.name ?? user.email}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-muted-foreground">{user.email}</span>
        <LogoutButton />
      </CardContent>
    </Card>
  );
}

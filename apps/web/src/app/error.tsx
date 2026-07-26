"use client";

import { Button } from "@/shared/ui/button";

/**
 * Граница ошибок маршрутов: ловит сбои серверного рендера (напр. недоступный API
 * или протухший токен при фетче списка) и показывает мягкий фолбэк вместо падения.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Не удалось загрузить данные. Проверьте соединение и попробуйте снова.
      </p>
      <Button onClick={reset}>Повторить</Button>
    </main>
  );
}

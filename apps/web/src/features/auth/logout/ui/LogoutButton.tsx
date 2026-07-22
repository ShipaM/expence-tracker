"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/shared/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    setPending(false);
  }

  return (
    <Button variant="outline" onClick={onLogout} disabled={pending}>
      {pending ? "Выходим…" : "Выйти"}
    </Button>
  );
}

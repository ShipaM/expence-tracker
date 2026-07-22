"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserDto } from "@repo/shared";

const SessionContext = createContext<UserDto | null>(null);

/** Держит текущего пользователя; начальное значение приходит с сервера (layout). */
export function SessionProvider({
  user,
  children,
}: {
  user: UserDto | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Текущий пользователь на клиенте (null — не залогинен). */
export function useSession(): UserDto | null {
  return useContext(SessionContext);
}

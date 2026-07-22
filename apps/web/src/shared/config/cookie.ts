/** Имя httpOnly-куки, в которой лежит JWT. Наружу в JS не отдаётся. */
export const SESSION_COOKIE = "session";

// 7 дней — совпадает со сроком жизни JWT на API (auth.module.ts: expiresIn "7d").
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Опции для cookies().set — httpOnly, lax, secure только в проде. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

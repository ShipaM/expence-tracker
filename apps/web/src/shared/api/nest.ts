import "server-only";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface NestRequestInit extends RequestInit {
  /** JWT из httpOnly-куки; уходит в заголовок Authorization: Bearer. */
  token?: string;
}

/**
 * Низкоуровневый запрос к Nest API (`${NEXT_PUBLIC_API_URL}/api${path}`).
 * Только сервер (Route Handlers, серверные компоненты): токен из httpOnly-куки
 * в браузер не утекает. Возвращает сырой Response — вызывающий сам решает,
 * пробросить статус/тело ошибки или упасть.
 */
export function nestFetch(path: string, init: NestRequestInit = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  return fetch(`${API_URL}/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
}

/** Обёртка для случаев «нужен разобранный JSON, ошибка = исключение». */
export async function nestJson<T>(path: string, init: NestRequestInit = {}): Promise<T> {
  const response = await nestFetch(path, init);
  if (!response.ok) {
    throw new Error(`Запрос ${path} завершился со статусом ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

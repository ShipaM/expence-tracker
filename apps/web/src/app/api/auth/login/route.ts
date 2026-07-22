import { proxyAuth } from "@/shared/api/auth.server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return proxyAuth("/auth/login", body);
}

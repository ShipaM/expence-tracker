"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginDto } from "@repo/shared";

export function useLogin() {
  const router = useRouter();
  const form = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginDto) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      router.push("/");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => ({}));
    const issues = Array.isArray(data?.issues) ? data.issues : null;

    if (issues) {
      for (const issue of issues) {
        const key = issue?.path?.[0];
        if (key === "email" || key === "password") {
          form.setError(key, { message: issue?.message });
        }
      }
      return;
    }

    // 401 «Неверный email или пароль» и прочие ошибки — общей ошибкой формы.
    form.setError("root", {
      message: typeof data?.message === "string" ? data.message : "Не удалось войти",
    });
  }

  return { form, onSubmit: form.handleSubmit(onSubmit) };
}

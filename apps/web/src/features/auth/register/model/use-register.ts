"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { registerSchema, type RegisterDto } from "@repo/shared";

export function useRegister() {
  const router = useRouter();
  const form = useForm<RegisterDto>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", name: "", password: "" },
  });

  async function onSubmit(values: RegisterDto) {
    const response = await fetch("/api/auth/register", {
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

    // 409 «Email уже занят» — под поле email.
    if (response.status === 409) {
      form.setError("email", {
        message: typeof data?.message === "string" ? data.message : "Email уже занят",
      });
      return;
    }

    const issues = Array.isArray(data?.issues) ? data.issues : null;
    if (issues) {
      for (const issue of issues) {
        const key = issue?.path?.[0];
        if (key === "email" || key === "name" || key === "password") {
          form.setError(key, { message: issue?.message });
        }
      }
      return;
    }

    form.setError("root", {
      message:
        typeof data?.message === "string" ? data.message : "Не удалось зарегистрироваться",
    });
  }

  return { form, onSubmit: form.handleSubmit(onSubmit) };
}

"use client";

import Link from "next/link";

import { BalanceRule, type BalanceSegment } from "@/shared/ui/balance-rule";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { LEDGER_INPUT, LEDGER_LABEL, LEDGER_SUBMIT } from "@/shared/ui/ledger-field";
import { PasswordInput } from "@/shared/ui/password-input";

import { useRegister } from "../model/use-register";

export function RegisterForm() {
  const { form, onSubmit } = useRegister();
  const { errors, isSubmitting } = form.formState;
  const rootError = errors.root?.message;

  const values = form.watch();
  const textSegment = (name: "name" | "email" | "password"): BalanceSegment => {
    if (errors[name]) return "error";
    return values[name]?.trim() ? "valid" : "empty";
  };
  const agreeSegment: BalanceSegment = errors.agree
    ? "error"
    : values.agree
      ? "valid"
      : "empty";

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="grid grid-cols-[1.5rem_1fr] gap-x-5"
      >
        <div className="row-span-full">
          <BalanceRule
            segments={[
              textSegment("name"),
              textSegment("email"),
              textSegment("password"),
              agreeSegment,
            ]}
          />
        </div>

        <div className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "60ms" }}>
                <FormLabel className={LEDGER_LABEL}>Имя</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder="Иван"
                    className={LEDGER_INPUT}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="font-mono text-[0.6875rem]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "110ms" }}>
                <FormLabel className={LEDGER_LABEL}>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={LEDGER_INPUT}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="font-mono text-[0.6875rem]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "160ms" }}>
                <FormLabel className={LEDGER_LABEL}>Пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className={LEDGER_INPUT}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="font-mono text-[0.6875rem]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agree"
            render={({ field }) => (
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "210ms" }}>
                <div className="flex items-start gap-2.5">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className="mt-0.5 rounded-none"
                    />
                  </FormControl>
                  <FormLabel className="block text-[0.8125rem] leading-snug font-normal text-ink/70">
                    Согласен с{" "}
                    <Link
                      href="/terms"
                      className="text-ink underline underline-offset-2 hover:decoration-2"
                    >
                      пользовательским соглашением
                    </Link>{" "}
                    и{" "}
                    <Link
                      href="/privacy"
                      className="text-ink underline underline-offset-2 hover:decoration-2"
                    >
                      политикой обработки данных
                    </Link>
                  </FormLabel>
                </div>
                <FormMessage className="font-mono text-[0.6875rem]" />
              </FormItem>
            )}
          />

          {rootError ? (
            <p
              role="alert"
              className="border-l-2 border-l-debit bg-debit/[0.06] py-2 pl-3 font-mono text-[0.6875rem] leading-relaxed text-debit"
            >
              {rootError}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={`ledger-rise ${LEDGER_SUBMIT}`}
            style={{ animationDelay: "260ms" }}
          >
            {isSubmitting ? "Создаём аккаунт…" : "Создать аккаунт"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

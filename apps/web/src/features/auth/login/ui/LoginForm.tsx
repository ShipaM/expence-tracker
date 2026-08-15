"use client";

import { BalanceRule, type BalanceSegment } from "@/shared/ui/balance-rule";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { LEDGER_INPUT, LEDGER_LABEL, LEDGER_SUBMIT } from "@/shared/ui/ledger-field";
import { PasswordInput } from "@/shared/ui/password-input";

import { useLogin } from "../model/use-login";

export function LoginForm() {
  const { form, onSubmit } = useLogin();
  const { errors, isSubmitting } = form.formState;
  const rootError = errors.root?.message;

  const values = form.watch();
  const segmentOf = (name: "email" | "password"): BalanceSegment => {
    if (errors[name]) return "error";
    return values[name]?.trim() ? "valid" : "empty";
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-[1.5rem_1fr] gap-x-5">
        <div className="row-span-full">
          <BalanceRule segments={[segmentOf("email"), segmentOf("password")]} />
        </div>

        <div className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "60ms" }}>
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
              <FormItem className="ledger-rise gap-1.5" style={{ animationDelay: "120ms" }}>
                <FormLabel className={LEDGER_LABEL}>Пароль</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    className={LEDGER_INPUT}
                    {...field}
                  />
                </FormControl>
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
            style={{ animationDelay: "180ms" }}
          >
            {isSubmitting ? "Входим…" : "Войти"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

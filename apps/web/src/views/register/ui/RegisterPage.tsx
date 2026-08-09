import { RegisterForm } from "@/features/auth/register";
import { AuthFrame } from "@/widgets/auth-frame";

export function RegisterPage() {
  return (
    <AuthFrame active="register">
      <RegisterForm />
    </AuthFrame>
  );
}

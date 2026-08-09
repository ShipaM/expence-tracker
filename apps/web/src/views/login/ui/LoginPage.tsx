import { LoginForm } from "@/features/auth/login";
import { AuthFrame } from "@/widgets/auth-frame";

export function LoginPage() {
  return (
    <AuthFrame active="login">
      <LoginForm />
    </AuthFrame>
  );
}

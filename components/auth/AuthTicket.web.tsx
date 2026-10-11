import type { FormEvent, MouseEvent, ReactNode } from "react";
import { useRouter } from "expo-router";
import { ticketLandingCss } from "@/components/landing/ticketLandingStyles";
import { authTicketCss } from "./authTicketStyles";
import { useRegisterForm, useSignInForm } from "./useAuthForms";

// Web sign-in and register pages drawn as the landing page's admission ticket. Plain DOM, like
// the landing, so the ticket perforation and fonts match exactly and password managers see a
// real form.
const ASSETS = "/landing";

type Route = "/" | "/login" | "/register";

function RouteLink({ href, className, children }: { href: Route; className?: string; children: ReactNode }) {
  const router = useRouter();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.push(href);
  };
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
}) {
  return (
    <label className="tk-field">
      <span>{label}</span>
      <div className="tk-pw">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="tk-reveal"
          onClick={onToggleVisible}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

function EmailField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="tk-field">
      <span>Email</span>
      <input
        type="email"
        name="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="you@example.com"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function FormMessages({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error ? <p className="tk-msg tk-msg-err" role="alert">{error}</p> : null}
      {success ? <p className="tk-msg tk-msg-ok" role="status">{success}</p> : null}
    </>
  );
}

function SignInForm() {
  const form = useSignInForm();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.handleSignIn();
  };

  return (
    <form className="tk-t-main" onSubmit={onSubmit} noValidate>
      <span className="tk-t-k">Sign in</span>
      <h1>Welcome back</h1>
      <p>Your queue, progress and schedule are right where you left them.</p>
      <div className="tk-fields">
        <EmailField value={form.email} onChange={form.setEmail} disabled={form.isPending} />
        <PasswordField
          label="Password"
          name="password"
          value={form.password}
          onChange={form.setPassword}
          visible={form.showPassword}
          onToggleVisible={() => form.setShowPassword((prev) => !prev)}
          autoComplete="current-password"
          disabled={form.isPending}
        />
      </div>
      <FormMessages error={form.error} success={form.success} />
      <div className="tk-auth-actions">
        <button type="submit" className="tk-btn tk-btn-ink" disabled={form.isPending}>
          {form.isPending ? "Signing in..." : "Sign in"}
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-line"
          disabled={form.isPending}
          onClick={() => {
            void form.handleAnonymousSignIn();
          }}
        >
          Continue as guest
        </button>
      </div>
    </form>
  );
}

function RegisterForm() {
  const form = useRegisterForm();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.handleRegister();
  };

  return (
    <form className="tk-t-main" onSubmit={onSubmit} noValidate>
      <span className="tk-t-k">New account</span>
      <h1>Get in free</h1>
      <p>Start with what you're watching now. Your queue builds itself from there.</p>
      <div className="tk-fields">
        <EmailField value={form.email} onChange={form.setEmail} disabled={form.isPending} />
        <PasswordField
          label="Password"
          name="password"
          value={form.password}
          onChange={form.setPassword}
          visible={form.showPassword}
          onToggleVisible={() => form.setShowPassword((prev) => !prev)}
          autoComplete="new-password"
          disabled={form.isPending}
        />
        <PasswordField
          label="Confirm password"
          name="confirm-password"
          value={form.confirmPassword}
          onChange={form.setConfirmPassword}
          visible={form.showConfirmPassword}
          onToggleVisible={() => form.setShowConfirmPassword((prev) => !prev)}
          autoComplete="new-password"
          disabled={form.isPending}
        />
      </div>
      <FormMessages error={form.error} success={form.success} />
      <div className="tk-auth-actions">
        <button type="submit" className="tk-btn tk-btn-ink" disabled={form.isPending}>
          {form.isPending ? "Creating account..." : "Create account"}
        </button>
      </div>
    </form>
  );
}

export function AuthTicket({ mode }: { mode: "signIn" | "signUp" }) {
  const isSignIn = mode === "signIn";

  return (
    <div className="tk tk-auth">
      <style>{ticketLandingCss + authTicketCss}</style>

      <header className="tk-nav">
        <div className="tk-wrap">
          <RouteLink href="/" className="tk-logo">
            <img src={`${ASSETS}/mark.png`} alt="" />
            ShowTracker
          </RouteLink>
          <div className="tk-nav-cta">
            {isSignIn ? (
              <RouteLink href="/register" className="tk-btn tk-btn-paper">Get started</RouteLink>
            ) : (
              <RouteLink href="/login" className="tk-btn tk-btn-paper">Sign in</RouteLink>
            )}
          </div>
        </div>
      </header>

      <main className="tk-wrap tk-auth-main">
        <p className="tk-kick">{isSignIn ? "Box office · Returning guests" : "Box office · Free admission"}</p>
        <div className="tk-ticket tk-auth-ticket">
          {isSignIn ? <SignInForm /> : <RegisterForm />}
          <div className="tk-t-stub">
            <span className="tk-admit">Admit<br />one</span>
            <div className="tk-barcode" aria-hidden="true" />
            <span className="tk-no">{isSignIn ? "NO. 000001 · ROW A" : "NEW SEAT · ROW A"}</span>
            {isSignIn ? (
              <small>New here? <RouteLink href="/register">Create an account</RouteLink></small>
            ) : (
              <small>Have an account? <RouteLink href="/login">Sign in</RouteLink></small>
            )}
          </div>
        </div>
        <div className="tk-genres" aria-label="What you can track">
          <span>TV shows</span><span>Anime</span><span>Movies</span>
        </div>
      </main>
    </div>
  );
}

import { type Href, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Form state and submit logic shared by the native auth screens and the web ticket pages.

export function useSignInForm() {
  const { signIn } = useAuthActions();
  const checkPasswordAccount = useMutation(api.auth.checkPasswordAccount);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleAuthResult = (
    result: Awaited<ReturnType<typeof signIn>>,
    messages: { fallback: string }
  ) => {
    const { redirect, signingIn } = result;

    if (redirect instanceof URL || typeof redirect === "string") {
      const redirectTarget = redirect.toString();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = redirectTarget;
      } else {
        router.replace(redirectTarget as Href);
      }
      return;
    }

    if (signingIn === true) {
      setSuccess("Signed in. Opening your dashboard...");
      return;
    }

    setError(messages.fallback);
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      // Account check now returns generic response to prevent enumeration
      // Proceed with sign-in attempt directly
      await checkPasswordAccount({ email });

      const result = await signIn("password", {
        flow: "signIn",
        email: email.trim().toLowerCase(),
        password,
      });

      handleAuthResult(result, {
        fallback: "Invalid email or password. Please try again.",
      });
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : "";

      if (errorMessage.includes("Invalid") || errorMessage.includes("credential")) {
        setError("Invalid email or password.");
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        setError("Network error. Check your connection and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await signIn("anonymous");
      handleAuthResult(result, {
        fallback: "Failed to continue as guest. Please try again.",
      });
    } catch {
      setError("Failed to continue as guest.");
    } finally {
      setIsPending(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    success,
    isPending,
    handleSignIn,
    handleAnonymousSignIn,
  };
}

export function useRegisterForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  const handleRegister = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(null);

    try {
      const didSignIn = await signIn("password", {
        flow: "signUp",
        email: email.trim().toLowerCase(),
        password,
      });

      if (didSignIn) {
        setSuccess("Account ready. Taking you to your dashboard...");
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current);
        }
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null;
          router.replace("/home");
        }, 900);
        return;
      }

      setError("Unable to create account. Please try again.");
    } catch (authError) {
      console.error("Register failed", authError);
      const errorMessage = authError instanceof Error ? authError.message : "";

      if (errorMessage.includes("already exists") || errorMessage.includes("taken")) {
        setError("An account with this email already exists.");
      } else if (errorMessage.includes("invalid") || errorMessage.includes("email")) {
        setError("Please enter a valid email address.");
      } else if (errorMessage.includes("weak") || errorMessage.includes("password")) {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        setError("Network error. Check your connection and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsPending(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    error,
    success,
    isPending,
    handleRegister,
  };
}

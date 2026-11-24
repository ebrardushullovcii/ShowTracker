import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

type SignOutState = {
  isSigningOut: boolean;
  signOutError: string | null;
  requestSignOut: () => void;
};

const SignOutContext = createContext<SignOutState | null>(null);

export function SignOutProvider({ children }: PropsWithChildren) {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSigningOut) return;

    // AuthGate unmounts private screens in the commit before this effect
    // revokes the session. Otherwise their live queries can fail during sign-out.
    void signOut().catch(() => {
      setSignOutError("Could not sign out. Please try again.");
      setIsSigningOut(false);
    });
  }, [isSigningOut, signOut]);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) setIsSigningOut(false);
  }, [isAuthenticated, isLoading]);

  const value = useMemo(() => ({
    isSigningOut,
    signOutError,
    requestSignOut: () => {
      setSignOutError(null);
      setIsSigningOut(true);
    },
  }), [isSigningOut, signOutError]);

  return <SignOutContext.Provider value={value}>{children}</SignOutContext.Provider>;
}

export function useSignOut() {
  const value = useContext(SignOutContext);
  if (!value) throw new Error("SignOutProvider is missing");
  return value;
}

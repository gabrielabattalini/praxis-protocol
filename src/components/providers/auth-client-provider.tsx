"use client";

import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useClerk as useClerkClientHook,
  useUser as useClerkUser,
} from "@clerk/nextjs";
import { createContext, useContext, useMemo } from "react";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

type AuthSnapshot = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
};

type UserSnapshot = {
  user: ReturnType<typeof useClerkUser>["user"] | null;
};

type ClerkSnapshot = {
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
};

type AuthClientContextValue = {
  auth: AuthSnapshot;
  user: UserSnapshot;
  clerk: ClerkSnapshot;
};

const fallbackContextValue: AuthClientContextValue = {
  auth: {
    isLoaded: true,
    isSignedIn: true,
    userId: null,
  },
  user: {
    user: null,
  },
  clerk: {
    signOut: async (options) => {
      if (typeof window !== "undefined") {
        window.location.assign(options?.redirectUrl ?? "/");
      }
    },
  },
};

const AuthClientContext =
  createContext<AuthClientContextValue>(fallbackContextValue);

function AuthClientBridge({ children }: { children: React.ReactNode }) {
  const auth = useClerkAuth();
  const user = useClerkUser();
  const clerk = useClerkClientHook();

  const value = useMemo<AuthClientContextValue>(
    () => ({
      auth: {
        isLoaded: auth.isLoaded,
        isSignedIn: auth.isSignedIn ?? false,
        userId: auth.userId ?? null,
      },
      user: {
        user: user.user ?? null,
      },
      clerk: {
        signOut: clerk.signOut,
      },
    }),
    [
      auth.isLoaded,
      auth.isSignedIn,
      auth.userId,
      clerk.signOut,
      user.user,
    ],
  );

  return (
    <AuthClientContext.Provider value={value}>
      {children}
    </AuthClientContext.Provider>
  );
}

type AuthClientProviderProps = {
  children: React.ReactNode;
  clerkProps?: Omit<React.ComponentProps<typeof ClerkProvider>, "children">;
};

export function AuthClientProvider({
  children,
  clerkProps,
}: AuthClientProviderProps) {
  if (isLocalAuthBypassEnabled) {
    return (
      <AuthClientContext.Provider value={fallbackContextValue}>
        {children}
      </AuthClientContext.Provider>
    );
  }

  return (
    <ClerkProvider {...clerkProps}>
      <AuthClientBridge>{children}</AuthClientBridge>
    </ClerkProvider>
  );
}

export function useAuthClient() {
  return useContext(AuthClientContext).auth;
}

export function useUserClient() {
  return useContext(AuthClientContext).user;
}

export function useClerkClient() {
  return useContext(AuthClientContext).clerk;
}

"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const logout = async () => {
    await signOut({ redirect: false });
    router.push("/auth/signin");
  };

  return {
    session,
    status,
    isAuthenticated: !!session,
    isLoading: status === "loading",
    logout,
  };
}

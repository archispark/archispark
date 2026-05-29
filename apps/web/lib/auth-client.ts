import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:8000",
  plugins: [usernameClient(), adminClient()],
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;

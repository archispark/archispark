import { createAuthClient } from "better-auth/react";
import { usernameClient, adminClient, genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:8001",
  plugins: [usernameClient(), adminClient(), genericOAuthClient()],
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;

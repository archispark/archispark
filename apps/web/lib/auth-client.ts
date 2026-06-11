import { createAuthClient } from "better-auth/react";
import { usernameClient, adminClient, organizationClient, genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:8000",
  plugins: [usernameClient(), adminClient(), organizationClient({ teams: { enabled: true } }), genericOAuthClient()],
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;

// src/hooks/team/useAccountSetup.ts
//
// Hooks for the public /set-password page: validate the setup token (read-only)
// and set the account password. Keeps the UI out of the services layer per the
// barrel-import rule.

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  setAccountPassword,
  validateSetupToken,
} from "@/services/users/accountSetupService";

export function useSetupTokenValidation(token: string | undefined) {
  return useQuery({
    queryKey: ["account-setup-token", token],
    queryFn: () => validateSetupToken(token as string),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

export function useSetAccountPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      setAccountPassword(token, password),
  });
}

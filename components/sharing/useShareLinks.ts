import { useCallback } from "react";
import { Platform } from "react-native";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { normalizeSharedGame, type SharedGame } from "@/lib/sharing/share-link";

export function useShareLinks() {
  const create = useAction(api.sharedGameActions.create);
  const revoke = useMutation(api.sharedGames.revoke);
  return useCallback(async (message: { type?: string; snapshot?: SharedGame; token?: string }) => {
    if (message.type === "create-game-link" && message.snapshot) {
      const snapshot = normalizeSharedGame(message.snapshot);
      const link = await create(snapshot);
      const origin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "https://showtrackerapp.netlify.app";
      return { ...link, url: `${origin}/share/${link.token}` };
    }
    if (message.type === "revoke-game-link" && typeof message.token === "string") {
      await revoke({ token: message.token });
      return { revoked: true };
    }
    throw new Error("Invalid share request.");
  }, [create, revoke]);
}

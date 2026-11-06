import { customAction, customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { action as baseAction, mutation as baseMutation, query as baseQuery } from "../_generated/server";
import { requireApproved } from "./accessPolicy";

const approved = customCtx(async (ctx: Parameters<typeof requireApproved>[0]) => {
  await requireApproved(ctx);
  return {};
});

export const query = customQuery(baseQuery, approved);
export const mutation = customMutation(baseMutation, approved);
export const action = customAction(baseAction, approved);

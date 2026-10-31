import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing EXPO_PUBLIC_CONVEX_URL");
}

if (convexUrl !== "https://ceaseless-salmon-10.eu-west-1.convex.cloud") {
  throw new Error("This comparison build must use the separate EU backend.");
}

export const convex = new ConvexReactClient(convexUrl);

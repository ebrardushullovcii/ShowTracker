import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { TicketLanding } from "@/components/landing/TicketLanding";

export default function LandingPage() {
  if (Platform.OS !== "web") {
    return <Redirect href="/login" />;
  }

  return <TicketLanding />;
}

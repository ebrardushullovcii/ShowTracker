import { Redirect } from "expo-router";
import { Platform } from "react-native";
import SearchScreen from "@/components/SearchScreen";

export default function FindRoute() {
  return Platform.OS === "ios" ? <SearchScreen showBack /> : <Redirect href="/search" />;
}

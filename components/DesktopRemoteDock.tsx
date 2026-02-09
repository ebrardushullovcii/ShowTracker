import type { ReactNode } from "react";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, usePathname, useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { DESKTOP_TAB_RAIL_WIDTH } from "@/constants/navigation";

type RemoteItem = {
  key: "home" | "discover" | "search" | "profile" | "more";
  label: string;
  href: Href;
  isActive: (pathname: string) => boolean;
  renderIcon: (focused: boolean, color: string) => ReactNode;
};

const REMOTE_ITEMS: RemoteItem[] = [
  {
    key: "home",
    label: "Home",
    href: "/",
    isActive: (pathname) => pathname === "/",
    renderIcon: (focused, color) => (
      <Ionicons name={focused ? "home" : "home-outline"} size={20} color={color} />
    ),
  },
  {
    key: "discover",
    label: "Discover",
    href: "/discover",
    isActive: (pathname) => pathname.startsWith("/discover"),
    renderIcon: (focused, color) => (
      <MaterialCommunityIcons
        name={focused ? "television-classic" : "television-classic-off"}
        size={20}
        color={color}
      />
    ),
  },
  {
    key: "search",
    label: "Search",
    href: "/search",
    isActive: (pathname) => pathname.startsWith("/search"),
    renderIcon: (focused, color) => (
      <Feather name="search" size={20} color={focused ? color : color} />
    ),
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    isActive: (pathname) => pathname.startsWith("/profile"),
    renderIcon: (focused, color) => (
      <Ionicons name={focused ? "person" : "person-outline"} size={20} color={color} />
    ),
  },
  {
    key: "more",
    label: "More",
    href: "/extra",
    isActive: (pathname) => pathname.startsWith("/extra"),
    renderIcon: (focused, color) => (
      <Ionicons name={focused ? "grid" : "grid-outline"} size={20} color={color} />
    ),
  },
];

export function DesktopRemoteDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const activeColor = "#d16042";
  const inactiveColor = isDark ? "#c4d4e8" : "#614e37";
  const shellClass = isDark
    ? "border-brand-frame-light/35 bg-[#101a2a]"
    : "border-brand-frame/70 bg-[#e5dbc9]";
  const bodyClass = isDark
    ? "border-brand-surface/80 bg-[#162337]"
    : "border-brand-frame/45 bg-[#eee4d4]";
  const idleButtonClass = isDark
    ? "border-brand-surface/70 bg-[#0f1b2c]"
    : "border-brand-frame/45 bg-[#ece3d3]";
  const activeButtonClass = isDark
    ? "border-brand-primary/75 bg-brand-primary/15"
    : "border-brand-primary/65 bg-brand-primary/12";

  return (
    <View className="absolute bottom-1 left-1 top-1 z-40 justify-center" style={{ width: DESKTOP_TAB_RAIL_WIDTH }}>
      <View className={`h-full rounded-[26px] border-2 p-1 ${shellClass}`}>
        <View className={`h-full rounded-[21px] border px-1 pb-3 pt-3 ${bodyClass}`}>
          <View className="items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
            <Text className="text-[8px] font-bold uppercase tracking-[1.55px] text-brand-ink-soft dark:text-[#cfdeef]">
              TV Remote
            </Text>
          </View>

          <View className="my-2.5 h-px bg-brand-frame/30 dark:bg-brand-frame-light/20" />

          <View className="gap-2">
            {REMOTE_ITEMS.map((item) => {
              const focused = item.isActive(pathname);
              const tint = focused ? activeColor : inactiveColor;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => router.replace(item.href)}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  className={`items-center rounded-2xl border-2 px-1.5 py-2 ${
                    focused ? activeButtonClass : idleButtonClass
                  }`}
                  style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
                >
                  <View className="items-center gap-1">
                    <View
                      className={`h-9 w-9 items-center justify-center rounded-full border-2 ${
                        focused
                          ? "border-brand-primary/70 bg-brand-primary/15"
                          : "border-brand-frame/45 bg-brand-light-background/75 dark:border-brand-surface/70 dark:bg-brand-background/50"
                      }`}
                    >
                      {item.renderIcon(focused, tint)}
                    </View>
                    <Text
                      className={`text-[8px] font-bold uppercase tracking-[1.2px] ${
                        focused
                          ? "text-brand-primary"
                          : "text-brand-ink-soft dark:text-[#c6d5e8]"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-auto items-center pt-3">
            <View className="w-full rounded-full border border-brand-frame/35 bg-brand-light-surface/70 px-1.5 py-2 dark:border-brand-surface/65 dark:bg-brand-background/55">
              <View className="mx-auto h-9 w-9 items-center justify-center rounded-full border-2 border-brand-frame/45 bg-brand-light-background/85 dark:border-brand-surface/70 dark:bg-brand-background/75">
                <View className="h-3 w-3 rounded-full border border-brand-frame/55 dark:border-brand-surface/60" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

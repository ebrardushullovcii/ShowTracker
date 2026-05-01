import { Feather, Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESKTOP_SIDEBAR_BREAKPOINT } from "@/constants/navigation";

const MOBILE_WEB_TAB_BAR_HEIGHT = 54;

function MobileWebTabBar({ state, descriptors, navigation }: any) {
  const routes = state.routes.filter((route: any) => descriptors[route.key]?.options?.href !== null);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row border-t-2 border-border-default bg-bg-base"
      style={{ height: MOBILE_WEB_TAB_BAR_HEIGHT }}
    >
      {routes.map((route: any) => {
        const focused = state.routes[state.index]?.key === route.key;
        const options = descriptors[route.key]?.options ?? {};
        const color = focused ? "#ef4444" : "#a1a1aa";
        const title = options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : undefined}
            onPress={onPress}
            className="flex-1 items-center justify-center"
          >
            {options.tabBarIcon?.({ focused, color, size: 22 })}
            <Text
              className="mt-0.5 text-[10px] font-black uppercase tracking-[0.5px]"
              style={{ color }}
            >
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === "web" && width >= DESKTOP_SIDEBAR_BREAKPOINT;
  const isMobileWeb = Platform.OS === "web" && !isDesktop;
  const iosBottomInset = Math.max(insets.bottom, 16);
  const mobileTabBarPaddingBottom =
    Platform.OS === "ios" ? iosBottomInset + 10 : isMobileWeb ? 0 : 8;
  const mobileTabBarPaddingTop = Platform.OS === "ios" ? 2 : isMobileWeb ? 0 : 6;
  const mobileTabBarHeight =
    Platform.OS === "ios"
      ? Math.max(90, 50 + mobileTabBarPaddingTop + mobileTabBarPaddingBottom)
      : isMobileWeb
        ? MOBILE_WEB_TAB_BAR_HEIGHT
        : 64;

  return (
    <View className="flex-1" style={{ backgroundColor: "#09090b" }}>
      <Tabs
          tabBar={isMobileWeb ? (props) => <MobileWebTabBar {...props} /> : undefined}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: isDesktop
              ? { display: "none" }
              : {
                  backgroundColor: "#09090b",
                  borderTopWidth: 2,
                  borderTopColor: "#27272a",
                  height: mobileTabBarHeight,
                  paddingBottom: mobileTabBarPaddingBottom,
                  paddingTop: mobileTabBarPaddingTop,
                  position: isMobileWeb ? "absolute" : undefined,
                },
            tabBarActiveTintColor: "#ef4444",
            tabBarInactiveTintColor: "#a1a1aa",
            tabBarIconStyle: Platform.OS === "ios" ? { marginTop: -2 } : undefined,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "900",
              textTransform: "uppercase" as const,
              letterSpacing: 0.5,
              marginBottom: Platform.OS === "ios" ? 2 : 0,
            },
            tabBarShowLabel: true,
          }}
        >
          <Tabs.Screen
            name="home/index"
            options={{
              title: "Home",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="discover/index"
            options={{
              title: "Discover",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? "compass" : "compass-outline"} size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="recommendations"
            options={{
              title: "For You",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="search"
            options={{
              title: "Search",
              href: isDesktop ? undefined : null,
              tabBarIcon: ({ color }) => <Feather name="search" size={20} color={color} />,
            }}
          />
          <Tabs.Screen
            name="library/index"
            options={{
              title: "Library",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons
                  name={focused ? "albums" : "albums-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
              ),
            }}
          />
        </Tabs>
    </View>
  );
}

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  Pressable,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { useColorScheme } from "nativewind";

function SearchTabButton({
  onPress,
  accessibilityState,
}: {
  onPress?: PressableProps["onPress"];
  accessibilityState?: { selected?: boolean };
}) {
  const selected = accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      className="-mt-6 h-16 w-16 items-center justify-center rounded-full border-2 border-brand-surface bg-brand-primary"
      accessibilityRole="button"
      accessibilityLabel="Search"
    >
      <Feather name="search" size={22} color="#fff8ef" />
      <Text className="mt-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-white/90">
        {selected ? "Search" : "Find"}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: isDark ? "#19140f" : "#f9f0df",
          borderTopColor: isDark ? "#30271b" : "#2f2618",
          borderTopWidth: 2,
          height: 84,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#cf5d3f",
        tabBarInactiveTintColor: isDark ? "#e6d5b8" : "#4f3e27",
        tabBarLabelStyle: {
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "television-classic" : "television-classic-off"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "",
          tabBarLabel: "",
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <View className="w-[88px] items-center justify-center">
              <SearchTabButton
                onPress={props.onPress}
                accessibilityState={props.accessibilityState}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="extra"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={20}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="watchlist" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
    </Tabs>
  );
}

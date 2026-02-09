import { Feather } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";

interface PageBackButtonProps {
  label?: string;
  fallbackHref?: Href;
  className?: string;
}

export function PageBackButton({
  label = "Back",
  fallbackHref,
  className,
}: PageBackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <View
      className={`absolute left-2 top-2 z-20 flex-row ${className ?? ""}`.trim()}
    >
      <Pressable
        onPress={handleBack}
        className="h-10 flex-row items-center gap-2 rounded-full border-2 border-brand-frame/60 bg-brand-light-surface/95 px-4 dark:border-brand-surface/75 dark:bg-brand-surface/80"
        style={Platform.OS === "web" ? { cursor: "pointer" } : undefined}
      >
        <Feather name="chevron-left" size={16} color="#d16042" />
        <Text className="text-[11px] font-bold uppercase tracking-[1.1px] text-brand-ink dark:text-brand-text">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

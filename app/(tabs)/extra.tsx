import { Text, View } from "react-native";
import { ScreenWrapper } from "@/components/ScreenWrapper";

export default function ExtraScreen() {
  return (
    <ScreenWrapper>
      <View className="pb-10">
        <View className="rounded-[28px] border-2 border-brand-surface bg-brand-light-surface px-5 py-4 dark:bg-brand-surface/80">
          <Text className="font-serif text-3xl font-bold leading-9 text-brand-light-text dark:text-brand-text">
            Coming Soon
          </Text>
          <Text className="mt-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
            Placeholder tab for upcoming tools and actions.
          </Text>
        </View>
      </View>
    </ScreenWrapper>
  );
}

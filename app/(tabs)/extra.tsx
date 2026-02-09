import { Text, View } from "react-native";
import { ScreenWrapper } from "@/components/ScreenWrapper";

export default function ExtraScreen() {
  return (
    <ScreenWrapper>
      <View className="pb-10">
        <Text className="mb-3 px-1 font-serif text-2xl font-bold text-brand-light-text dark:text-brand-text">
          More
        </Text>
        <Text className="px-1 text-sm leading-6 text-[#5d4b33] dark:text-[#ebdabc]">
          Placeholder tab for upcoming tools and actions.
        </Text>
      </View>
    </ScreenWrapper>
  );
}

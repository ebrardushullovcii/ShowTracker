import { Image } from "expo-image";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import type { ReactNode } from "react";

interface HeroSectionProps {
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  mobileHeight?: number;
  className?: string;
}

export function HeroSection({
  imageUrl,
  title,
  subtitle,
  children,
  mobileHeight = 250,
  className,
}: HeroSectionProps) {
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const heroHeight = isWeb ? Math.max(280, Math.round(width * 0.25)) : mobileHeight;

  return (
    <View
      className={`relative w-full overflow-hidden ${className ?? ""}`.trim()}
      style={{ height: heroHeight }}
    >
      {/* Backdrop image */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
        />
      ) : (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#27272a" }} />
      )}

      {/* Content overlay */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 24, justifyContent: "flex-end" }}>
        {title ? (
          <Text
            style={{ color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}
            numberOfLines={2}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            style={{ color: "#d4d4d8", fontSize: 14, marginTop: 6, lineHeight: 20 }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
        {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    </View>
  );
}

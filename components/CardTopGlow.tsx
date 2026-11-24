import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

// Place inside a clipped bg-surface card so the fade blends into the surface.
export function CardTopGlow() {
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-0 h-3.5">
      <LinearGradient
        colors={["rgba(239,68,68,0)", "rgba(239,68,68,0.24)", "rgba(239,68,68,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(24,24,27,0)", "rgba(24,24,27,0.72)", "#18181b"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

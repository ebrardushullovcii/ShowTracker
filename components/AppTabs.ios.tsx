import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function IosTabsLayout() {
  return (
    <NativeTabs tintColor="#ef4444" disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="home/index">
        <Label>Home</Label>
        <Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover/index">
        <Label>Discover</Label>
        <Icon sf={{ default: "safari", selected: "safari.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recommendations">
        <Label>For You</Label>
        <Icon sf="sparkles" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library/index">
        <Label>Library</Label>
        <Icon sf={{ default: "rectangle.stack", selected: "rectangle.stack.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

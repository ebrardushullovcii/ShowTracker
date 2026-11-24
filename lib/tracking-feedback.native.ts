import { notificationAsync, NotificationFeedbackType } from "expo-haptics";

export function confirmTrackingChange() {
  void notificationAsync(NotificationFeedbackType.Success).catch(() => {});
}

import { Text } from "react-native";

export const POSTER_TITLE_LINE_HEIGHT = 18;
export const POSTER_TITLE_LINES = 2;

export function PosterCardTitle({
  title,
  className,
}: {
  title: string;
  className: string;
}) {
  return (
    <Text
      accessibilityLabel={title}
      className={`min-w-0 w-full ${className}`}
      style={{ fontSize: 14, lineHeight: POSTER_TITLE_LINE_HEIGHT }}
      numberOfLines={POSTER_TITLE_LINES}
      ellipsizeMode="tail"
    >
      {title}
    </Text>
  );
}

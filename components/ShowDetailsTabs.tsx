import { useEffect, useState, type ReactNode } from "react";
import { Image, Pressable, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { BrandLoader } from "@/components/BrandLoader";
import type { ShowCastMember, ShowCredits, ShowCrewMember } from "@/lib/api/credits";

type DetailsTab = "overview" | "cast" | "crew";

type ShowDetailsTabsProps = {
  /** Renders the existing overview block; `inCard` trims margins inside the tab card. */
  renderOverview: (inCard: boolean) => ReactNode;
  credits: ShowCredits | null;
  isLoadingCredits: boolean;
};

const GRID_GAP = 10;
const ROWS_BEFORE_SHOW_ALL = 4;
const SINGLE_COLUMN_BEFORE_SHOW_ALL = 6;

type CreditTag = { label: string; tone: "default" | "voice" | "main" | "roles" };

const tagToneClass: Record<CreditTag["tone"], { box: string; text: string }> = {
  default: { box: "border-border-bright bg-bg-surface", text: "text-text-secondary" },
  voice: { box: "border-accent/40 bg-accent/10", text: "text-accent" },
  main: { box: "border-warning/40 bg-warning/10", text: "text-warning" },
  roles: { box: "border-primary/40 bg-primary/10", text: "text-red-300" },
};

function columnsForWidth(width: number) {
  if (width >= 740) return 3;
  if (width >= 500) return 2;
  return 1;
}

// Before the grid measures itself, guess its width from the window so the
// first paint already has cards (desktop adds the sidebar and page padding).
function estimateGridWidth(windowWidth: number) {
  return windowWidth >= 1024 ? Math.min(windowWidth - 180, 860) : windowWidth - 40;
}

function isCharacterCredit(member: ShowCastMember) {
  return member.id.startsWith("anilist:character:");
}

function castTags(member: ShowCastMember): CreditTag[] {
  const tags: CreditTag[] = [];
  if (member.isMainCharacter) tags.push({ label: "Main", tone: "main" });
  if (member.isVoice) {
    const language = member.voiceLanguage;
    tags.push({
      label: language === "Japanese" ? "JP voice" : language ? `${language} voice` : "Voice",
      tone: "voice",
    });
  }
  if (member.roleCount && !member.isVoice) {
    tags.push({ label: `${member.roleCount} roles`, tone: "roles" });
  }
  if (member.episodeCount) {
    tags.push({ label: `${member.episodeCount} eps`, tone: "default" });
  }
  return tags;
}

function creditLine(crew: ShowCrewMember[]) {
  const withJob = (pattern: RegExp) =>
    crew.filter((member) => member.job.split(", ").some((job) => pattern.test(job)));
  const creators = withJob(/^Creator$/);
  if (creators.length > 0) {
    return { label: "Created by", names: creators.map((member) => member.name) };
  }
  const directors = withJob(/^Director$/);
  if (directors.length > 0) {
    return { label: "Directed by", names: directors.map((member) => member.name) };
  }
  return null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CreditPhoto({
  uri,
  fallbackName,
  width,
  height,
}: {
  uri?: string;
  fallbackName: string;
  width: number;
  height: number;
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-lg bg-bg-elevated"
      style={{ width, height }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />
      ) : (
        <Text className="text-sm font-black text-text-muted">{initials(fallbackName)}</Text>
      )}
    </View>
  );
}

function CreditCard({
  title,
  subtitle,
  imageUri,
  badgeUri,
  tags,
  isSingleColumn,
}: {
  title: string;
  subtitle?: string;
  imageUri?: string;
  badgeUri?: string;
  tags: CreditTag[];
  isSingleColumn: boolean;
}) {
  const photoWidth = isSingleColumn ? 52 : 60;
  const photoHeight = isSingleColumn ? 70 : 80;

  return (
    <View className="flex-1 flex-row items-start gap-3 rounded-[10px] border border-border-default bg-bg-base p-2">
      <View style={{ width: photoWidth, height: photoHeight }}>
        <CreditPhoto
          uri={imageUri}
          fallbackName={title}
          width={photoWidth}
          height={photoHeight}
        />
        {badgeUri ? (
          <View
            className="absolute overflow-hidden rounded-full border-2 border-bg-base bg-bg-elevated"
            style={{ right: -6, bottom: -6, width: 26, height: 26 }}
          >
            <Image source={{ uri: badgeUri }} style={{ width: 22, height: 22 }} resizeMode="cover" />
          </View>
        ) : null}
      </View>
      <View className="min-w-0 flex-1 pt-0.5">
        <Text
          className={`${isSingleColumn ? "text-sm" : "text-[13px]"} font-bold leading-snug text-text-primary`}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs leading-snug text-text-secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {tags.length > 0 ? (
          <View className="mt-1.5 flex-row flex-wrap gap-1">
            {tags.map((tag) => (
              <View
                key={tag.label}
                className={`rounded border px-1.5 py-0.5 ${tagToneClass[tag.tone].box}`}
              >
                <Text
                  className={`text-[9px] font-black uppercase tracking-[0.8px] ${tagToneClass[tag.tone].text}`}
                >
                  {tag.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CreditGrid<T>({
  items,
  keyOf,
  renderItem,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, isSingleColumn: boolean) => ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const columns = columnsForWidth(measuredWidth || estimateGridWidth(windowWidth));
  const isSingleColumn = columns === 1;
  const collapsedCount = isSingleColumn ? SINGLE_COLUMN_BEFORE_SHOW_ALL : columns * ROWS_BEFORE_SHOW_ALL;
  const canCollapse = items.length > collapsedCount;
  const visibleItems = showAll || !canCollapse ? items : items.slice(0, collapsedCount);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth !== measuredWidth) setMeasuredWidth(nextWidth);
  };

  return (
    <View onLayout={handleLayout}>
      <View className="flex-row flex-wrap" style={{ margin: -GRID_GAP / 2 }}>
        {visibleItems.map((item) => (
          <View
            key={keyOf(item)}
            className="flex-row"
            style={{ width: `${100 / columns}%`, padding: GRID_GAP / 2 }}
          >
            {renderItem(item, isSingleColumn)}
          </View>
        ))}
      </View>
      {canCollapse ? (
        <Pressable
          onPress={() => setShowAll((current) => !current)}
          accessibilityRole="button"
          className="mt-3 items-center rounded-lg border border-border-bright bg-bg-elevated py-2.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <Text className="text-[11px] font-black uppercase tracking-[1px] text-text-secondary">
            {showAll ? "Show less" : `Show all ${items.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ShowDetailsTabs({ renderOverview, credits, isLoadingCredits }: ShowDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("overview");
  const cast = credits?.cast ?? [];
  const crew = credits?.crew ?? [];
  const hasCastTab = isLoadingCredits || cast.length > 0;
  const hasCrewTab = isLoadingCredits || crew.length > 0;

  useEffect(() => {
    if ((activeTab === "cast" && !hasCastTab) || (activeTab === "crew" && !hasCrewTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, hasCastTab, hasCrewTab]);

  if (!hasCastTab && !hasCrewTab) {
    return <>{renderOverview(false)}</>;
  }

  const castLabel = cast.some(isCharacterCredit) ? "Characters" : "Cast";
  const tabs: { id: DetailsTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    ...(hasCastTab ? [{ id: "cast" as const, label: castLabel, count: cast.length || undefined }] : []),
    ...(hasCrewTab ? [{ id: "crew" as const, label: "Crew", count: crew.length || undefined }] : []),
  ];
  const credit = creditLine(crew);

  const loadingState = (
    <View className="flex-row items-center justify-center gap-2 py-6">
      <BrandLoader compact />
      <Text className="text-xs text-text-secondary">Loading credits...</Text>
    </View>
  );

  return (
    <View className="mb-6 rounded-xl border-2 border-border-default bg-bg-surface p-4">
      <View role="tablist" className="-mx-1 -mt-1 mb-4 flex-row border-b border-border-default">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`-mb-px flex-row items-baseline gap-1 border-b-2 px-3 pb-2.5 pt-1.5 ${
                isActive ? "border-primary" : "border-transparent"
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text
                className={`text-xs font-black uppercase tracking-[1px] ${
                  isActive ? "text-text-primary" : "text-text-muted"
                }`}
              >
                {tab.label}
              </Text>
              {tab.count ? (
                <Text className="text-[10px] font-bold text-text-muted">{tab.count}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {activeTab === "overview" ? renderOverview(true) : null}

      {activeTab === "cast" ? (
        isLoadingCredits && cast.length === 0 ? (
          loadingState
        ) : (
          <View>
            {credit ? (
              <Text className="mb-3 text-[13px] leading-5 text-text-secondary">
                {credit.label}{" "}
                <Text className="font-bold text-text-primary">{credit.names.join(", ")}</Text>
              </Text>
            ) : null}
            <CreditGrid
              items={cast}
              keyOf={(member) => member.id}
              renderItem={(member, isSingleColumn) => {
                const isCharacter = isCharacterCredit(member);
                return (
                  <CreditCard
                    title={(isCharacter ? member.character : member.name) ?? member.name}
                    subtitle={isCharacter ? member.name || undefined : member.character}
                    imageUri={isCharacter ? member.characterImageUrl : member.photoUrl}
                    badgeUri={isCharacter ? member.photoUrl : undefined}
                    tags={castTags(member)}
                    isSingleColumn={isSingleColumn}
                  />
                );
              }}
            />
          </View>
        )
      ) : null}

      {activeTab === "crew" ? (
        isLoadingCredits && crew.length === 0 ? (
          loadingState
        ) : (
          <CreditGrid
            items={crew}
            keyOf={(member) => member.id}
            renderItem={(member, isSingleColumn) => (
              <CreditCard
                title={member.name}
                subtitle={member.job}
                imageUri={member.photoUrl}
                tags={[]}
                isSingleColumn={isSingleColumn}
              />
            )}
          />
        )
      ) : null}
    </View>
  );
}

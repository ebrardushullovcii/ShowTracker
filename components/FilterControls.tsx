import { Children, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ClearFilterChip, DropdownFilterChip } from "@/components/FilterBar";
import { Sheet, SheetScrollView } from "@/components/Sheet";
import { SheetHeader } from "@/components/SheetHeader";

export type FilterOption = { value: string; label: string };

type FilterControlsProps = {
  genres: FilterOption[];
  selectedGenres: string[];
  onToggleGenre: (value: string) => void;
  onClearGenres: () => void;
  years: FilterOption[];
  selectedYear: string;
  onSelectYear: (value: string) => void;
  ratings: FilterOption[];
  selectedRating: string;
  onSelectRating: (value: string) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
  /** Shown on the genre sheet's done button, for example "24 titles". */
  resultLabel?: string;
  className?: string;
};

type OpenSheet = "genres" | "year" | "rating" | null;

function genreChipLabel(genres: FilterOption[], selected: string[]) {
  if (selected.length === 0) return "Genre";
  return genres.find((option) => option.value === selected[0])?.label ?? selected[0];
}

/**
 * Genre, year and rating filters. Each chip opens a drawer with large touch targets;
 * an active chip shows its value and has its own clear button.
 */
export function FilterControls({
  genres,
  selectedGenres,
  onToggleGenre,
  onClearGenres,
  years,
  selectedYear,
  onSelectYear,
  ratings,
  selectedRating,
  onSelectRating,
  hasActiveFilters,
  onClearAll,
  resultLabel,
  className,
}: FilterControlsProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const close = () => setOpenSheet(null);
  const yearLabel = years.find((option) => option.value === selectedYear)?.label ?? selectedYear;

  return (
    <View className={className}>
      <View className="flex-row flex-wrap justify-center gap-2">
        {genres.length > 0 ? (
          <DropdownFilterChip
            label={genreChipLabel(genres, selectedGenres)}
            // Kept outside the label so a long genre name cannot truncate the count.
            suffix={selectedGenres.length > 1 ? `+${selectedGenres.length - 1}` : undefined}
            active={selectedGenres.length > 0}
            open={openSheet === "genres"}
            onPress={() => setOpenSheet("genres")}
            onClear={onClearGenres}
            clearAccessibilityLabel="Clear genre filter"
          />
        ) : null}
        {years.length > 0 ? (
          <DropdownFilterChip
            label={selectedYear ? yearLabel : "Year"}
            active={Boolean(selectedYear)}
            open={openSheet === "year"}
            onPress={() => setOpenSheet("year")}
            onClear={() => onSelectYear("")}
            clearAccessibilityLabel="Clear year filter"
          />
        ) : null}
        {ratings.length > 0 ? (
          <DropdownFilterChip
            label={selectedRating ? `★ ${selectedRating}+` : "Rating"}
            active={Boolean(selectedRating)}
            open={openSheet === "rating"}
            onPress={() => setOpenSheet("rating")}
            onClear={() => onSelectRating("")}
            clearAccessibilityLabel="Clear rating filter"
          />
        ) : null}
        {hasActiveFilters ? <ClearFilterChip label="Clear all" onPress={onClearAll} /> : null}
      </View>

      <Sheet visible={openSheet === "genres"} onClose={close} label="Genres">
        <SheetHeader
          title="Genres"
          detail={selectedGenres.length > 0 ? `${selectedGenres.length} selected` : "Pick any"}
          onClose={close}
          closeLabel="Close genre filter"
        />
        <SheetScrollView className="shrink" contentContainerClassName="p-dialog-gutter">
          <TileGrid columns={2}>
            {genres.map((option) => (
              <OptionTile
                key={option.value}
                label={option.label}
                selected={selectedGenres.includes(option.value)}
                multi
                onPress={() => onToggleGenre(option.value)}
              />
            ))}
          </TileGrid>
        </SheetScrollView>
        <View className="flex-row gap-3 border-t border-border-default p-dialog-gutter">
          <Pressable
            accessibilityRole="button"
            disabled={selectedGenres.length === 0}
            onPress={onClearGenres}
            className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border-default bg-bg-elevated"
            style={{ opacity: selectedGenres.length === 0 ? 0.45 : 1 }}
          >
            <Text className="text-[15px] font-bold text-text-primary">Clear</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={close}
            className="min-h-12 flex-[2] items-center justify-center rounded-xl bg-primary"
          >
            <Text className="text-[15px] font-black text-white">{resultLabel ? `Show ${resultLabel}` : "Done"}</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={openSheet === "year"} onClose={close} label="Release year">
        <SheetHeader title="Release year" actionLabel="Done" onAction={close} />
        <SheetScrollView className="shrink" contentContainerClassName="gap-2 p-dialog-gutter">
          <OptionTile
            label="Any year"
            selected={!selectedYear}
            onPress={() => {
              onSelectYear("");
              close();
            }}
          />
          <TileGrid columns={4}>
            {years.map((option) => (
              <OptionTile
                key={option.value}
                label={option.label}
                selected={selectedYear === option.value}
                onPress={() => {
                  onSelectYear(option.value);
                  close();
                }}
                centered
              />
            ))}
          </TileGrid>
        </SheetScrollView>
      </Sheet>

      <Sheet visible={openSheet === "rating"} onClose={close} label="Minimum rating">
        <SheetHeader title="Minimum rating" actionLabel="Done" onAction={close} />
        <SheetScrollView className="shrink" contentContainerClassName="gap-2 p-dialog-gutter">
          <OptionTile
            label="Any rating"
            selected={!selectedRating}
            onPress={() => {
              onSelectRating("");
              close();
            }}
          />
          {ratings.map((option) => (
            <OptionTile
              key={option.value}
              label={`${option.value}+`}
              icon="star"
              selected={selectedRating === option.value}
              onPress={() => {
                onSelectRating(option.value);
                close();
              }}
            />
          ))}
        </SheetScrollView>
      </Sheet>
    </View>
  );
}

function OptionTile({
  label,
  selected,
  onPress,
  multi = false,
  centered = false,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  centered?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`min-h-12 flex-row items-center gap-2 rounded-xl border px-3.5 active:opacity-80 ${
        centered ? "justify-center" : "justify-between"
      } ${selected ? "border-primary bg-primary/20" : "border-border-default bg-bg-base"}`}
    >
      <View className="min-w-0 shrink flex-row items-center gap-1.5">
        {icon ? <Ionicons name={icon} size={15} color="#fbbf24" /> : null}
        <Text
          numberOfLines={1}
          className={`shrink text-[15px] ${selected ? "font-bold text-white" : "font-semibold text-text-secondary"}`}
        >
          {label}
        </Text>
      </View>
      {selected && !centered ? <Ionicons name="checkmark-circle" size={20} color="#ef4444" /> : null}
    </Pressable>
  );
}

const TILE_GAP = 8;

/** Even columns that have their final height on the first frame, so drawers open at the right size. */
function TileGrid({ columns, children }: { columns: number; children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return (
    <View style={{ gap: TILE_GAP }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row" style={{ gap: TILE_GAP }}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} className="min-w-0 flex-1">
              {row[column] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

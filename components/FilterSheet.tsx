import { useState, useCallback } from "react";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";
import { Button } from "./Button";
import type { ActiveFilters, FilterConfig } from "@/lib/filters";

interface FilterSheetProps {
  isVisible: boolean;
  onClose: () => void;
  filters: FilterConfig[];
  activeFilters: ActiveFilters;
  onApplyFilters: (filters: ActiveFilters) => void;
  onClearFilters: () => void;
}

// Section Header with expand/collapse
function SectionHeader({
  title,
  isExpanded,
  onToggle,
  badgeCount,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  badgeCount: number;
}) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center justify-between py-4"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-bold uppercase tracking-wider text-text-primary">
          {title}
        </Text>
        {badgeCount > 0 && (
          <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5">
            <Text className="text-xs font-bold text-white">{badgeCount}</Text>
          </View>
        )}
      </View>
      <Text className="text-lg text-text-secondary">
        {isExpanded ? "−" : "+"}
      </Text>
    </Pressable>
  );
}

// Compact Chip for options
function FilterChip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border px-3 py-2 ${
        isSelected
          ? "border-primary bg-primary"
          : "border-border-default bg-bg-surface"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          isSelected ? "text-white" : "text-text-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Genre Grid with Show More
function GenreGrid({
  options,
  selectedValues,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayOptions = showAll ? options : options.slice(0, 6);

  const toggleGenre = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {displayOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            isSelected={selectedValues.includes(option.value)}
            onPress={() => toggleGenre(option.value)}
          />
        ))}
      </View>

      {options.length > 6 && (
        <Pressable onPress={() => setShowAll(!showAll)} className="mt-3">
          <Text className="text-sm font-semibold text-primary">
            {showAll ? "Show Less" : `+${options.length - 6} More`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Year Selector - Decade buttons + All Years scroll
function YearSelector({
  selectedValue,
  onChange,
}: {
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<"decades" | "all">("decades");

  const decades = [
    { label: "2020s", years: [2024, 2023, 2022, 2021, 2020] },
    { label: "2010s", years: [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010] },
    { label: "2000s", years: [2009, 2008, 2007, 2006, 2005, 2004, 2003, 2002, 2001, 2000] },
    { label: "1990s", years: [1999, 1998, 1997, 1996, 1995, 1994, 1993, 1992, 1991, 1990] },
    { label: "1980s", years: [1989, 1988, 1987, 1986, 1985, 1984, 1983, 1982, 1981, 1980] },
    { label: "1970s", years: [1979, 1978, 1977, 1976, 1975, 1974, 1973, 1972, 1971, 1970] },
    { label: "1960s", years: [1969, 1968, 1967, 1966, 1965, 1964, 1963, 1962, 1961, 1960] },
    { label: "Older", years: [1959, 1958, 1957, 1956, 1955, 1954, 1953, 1952, 1951, 1950] },
  ];

  const [activeDecade, setActiveDecade] = useState<string | null>(null);

  // Generate all years from current down to 1950
  const allYears = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

  return (
    <View>
      {/* View toggle */}
      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => {
            onChange("");
            setActiveDecade(null);
            setViewMode("decades");
          }}
          className={`rounded-full border px-4 py-2 ${
            !selectedValue && viewMode === "decades"
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              !selectedValue && viewMode === "decades" ? "text-white" : "text-text-secondary"
            }`}
          >
            Any
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode("decades")}
          className={`rounded-full border px-4 py-2 ${
            viewMode === "decades" && selectedValue
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              viewMode === "decades" && selectedValue ? "text-white" : "text-text-secondary"
            }`}
          >
            By Decade
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode("all")}
          className={`rounded-full border px-4 py-2 ${
            viewMode === "all"
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              viewMode === "all" ? "text-white" : "text-text-secondary"
            }`}
          >
            All Years
          </Text>
        </Pressable>
      </View>

      {/* Decades view */}
      {viewMode === "decades" && (
        <View>
          <View className="flex-row flex-wrap gap-2">
            {decades.map((decade) => (
              <Pressable
                key={decade.label}
                onPress={() =>
                  setActiveDecade(activeDecade === decade.label ? null : decade.label)
                }
                className={`rounded-full border px-4 py-2 ${
                  activeDecade === decade.label
                    ? "border-primary bg-primary"
                    : "border-border-default bg-bg-surface"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    activeDecade === decade.label ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {decade.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Years in selected decade */}
          {activeDecade && (
            <View className="mt-3 rounded-xl border border-border-default bg-bg-surface p-3">
              <Text className="mb-2 text-xs font-semibold uppercase text-text-secondary">
                Select Year
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {decades
                    .find((d) => d.label === activeDecade)
                    ?.years.filter((y) => y <= currentYear)
                    .map((year) => (
                      <Pressable
                        key={year}
                        onPress={() => onChange(String(year))}
                        className={`rounded-lg border px-4 py-2 ${
                          selectedValue === String(year)
                            ? "border-primary bg-primary"
                            : "border-border-default bg-bg-primary"
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            selectedValue === String(year)
                              ? "text-white"
                              : "text-text-secondary"
                          }`}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* All Years view */}
      {viewMode === "all" && (
        <View className="rounded-xl border border-border-default bg-bg-surface p-3">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            className="max-h-16"
          >
            <View className="flex-row flex-wrap gap-2" style={{ width: 300 }}>
              {allYears.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => onChange(String(year))}
                  className={`rounded-lg border px-3 py-2 ${
                    selectedValue === String(year)
                      ? "border-primary bg-primary"
                      : "border-border-default bg-bg-primary"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selectedValue === String(year)
                        ? "text-white"
                        : "text-text-secondary"
                    }`}
                  >
                    {year}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Selected year display */}
      {selectedValue && (
        <View className="mt-3 flex-row items-center justify-between rounded-xl border border-border-default bg-bg-surface p-3">
          <Text className="text-sm font-semibold text-text-primary">
            Selected: {selectedValue}
          </Text>
          <Pressable
            onPress={() => onChange("")}
            className="rounded-full bg-border-default px-3 py-1"
          >
            <Text className="text-xs font-bold">✕</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Rating Selector
function RatingSelector({
  selectedValue,
  onChange,
}: {
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  const ratings = [
    { value: "8", label: "8+" },
    { value: "7", label: "7+" },
    { value: "6", label: "6+" },
    { value: "5", label: "5+" },
  ];

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => onChange("")}
        className={`flex-1 rounded-xl border py-3 ${
          !selectedValue
            ? "border-primary bg-primary"
            : "border-border-default bg-bg-surface"
        }`}
      >
        <Text
          className={`text-center text-sm font-semibold ${
            !selectedValue ? "text-white" : "text-text-secondary"
          }`}
        >
          Any
        </Text>
      </Pressable>

      {ratings.map((rating) => (
        <Pressable
          key={rating.value}
          onPress={() => onChange(rating.value)}
          className={`flex-1 rounded-xl border py-3 ${
            selectedValue === rating.value
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              selectedValue === rating.value ? "text-white" : "text-text-secondary"
            }`}
          >
            {rating.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Status Selector
function StatusSelector({
  options,
  selectedValue,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onChange("")}
        className={`rounded-full border px-4 py-2 ${
          !selectedValue
            ? "border-primary bg-primary"
            : "border-border-default bg-bg-surface"
        }`}
      >
        <Text
          className={`text-sm font-medium ${
            !selectedValue ? "text-white" : "text-text-secondary"
          }`}
        >
          Any
        </Text>
      </Pressable>

      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={`rounded-full border px-4 py-2 ${
            selectedValue === option.value
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              selectedValue === option.value ? "text-white" : "text-text-secondary"
            }`}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FilterSheet({
  isVisible,
  onClose,
  filters,
  activeFilters,
  onApplyFilters,
  onClearFilters,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<ActiveFilters>(activeFilters);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    genres: true,
    year: false,
    minRating: false,
    status: false,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onClearFilters();
  };

  const updateFilter = (id: string, value: string | string[]) => {
    setLocalFilters((prev) => {
      if (id === "year" || id === "minRating") {
        const numValue = value === "" ? undefined : Number(value);
        return { ...prev, [id]: numValue };
      }
      return { ...prev, [id]: value };
    });
  };

  const getFilterValue = (filterId: string): string | string[] | undefined => {
    const value = localFilters[filterId as keyof ActiveFilters];
    if (filterId === "year" || filterId === "minRating") {
      return value !== undefined ? String(value) : undefined;
    }
    return value as string | string[] | undefined;
  };

  const getActiveCount = (filterId: string): number => {
    const value = localFilters[filterId as keyof ActiveFilters];
    if (Array.isArray(value)) return value.length;
    return value !== undefined ? 1 : 0;
  };

  const totalActive = Object.values(localFilters).reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    return value !== undefined ? count + 1 : count;
  }, 0);

  const hasChanges = JSON.stringify(localFilters) !== JSON.stringify(activeFilters);

  const getFilterConfig = (filterId: string) => filters.find((f) => f.id === filterId);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Full screen container */}
      <View className="flex-1 bg-black/80">
        {/* Backdrop - closes on press */}
        <Pressable className="flex-1" onPress={onClose} />

        {/* Sheet */}
        <View className="max-h-[85%] rounded-t-3xl bg-bg-primary">
          {/* Handle */}
          <View className="items-center py-2">
            <View className="h-1 w-10 rounded-full bg-border-default" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border-default px-5 py-3">
            <Text className="text-lg font-black text-text-primary">Filters</Text>
            {totalActive > 0 && (
              <View className="rounded-full bg-primary px-2 py-0.5">
                <Text className="text-xs font-bold text-white">{totalActive}</Text>
              </View>
            )}
            <Pressable
              onPress={onClose}
              className="rounded-full bg-bg-surface px-4 py-2"
            >
              <Text className="text-sm font-semibold text-text-secondary">Close</Text>
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            {/* Genres Section */}
            {getFilterConfig("genres") && (
              <View className="border-b border-border-default">
                <SectionHeader
                  title="Genres"
                  isExpanded={expandedSections.genres}
                  onToggle={() => toggleSection("genres")}
                  badgeCount={getActiveCount("genres")}
                />
                {expandedSections.genres && (
                  <View className="pb-4">
                    <GenreGrid
                      options={getFilterConfig("genres")?.options || []}
                      selectedValues={(getFilterValue("genres") as string[]) || []}
                      onChange={(vals) => updateFilter("genres", vals)}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Year Section */}
            {getFilterConfig("year") && (
              <View className="border-b border-border-default">
                <SectionHeader
                  title="Year"
                  isExpanded={expandedSections.year}
                  onToggle={() => toggleSection("year")}
                  badgeCount={getActiveCount("year")}
                />
                {expandedSections.year && (
                  <View className="pb-4">
                    <YearSelector
                      selectedValue={getFilterValue("year") as string | undefined}
                      onChange={(val) => updateFilter("year", val)}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Rating Section */}
            {getFilterConfig("minRating") && (
              <View className="border-b border-border-default">
                <SectionHeader
                  title="Min Rating"
                  isExpanded={expandedSections.minRating}
                  onToggle={() => toggleSection("minRating")}
                  badgeCount={getActiveCount("minRating")}
                />
                {expandedSections.minRating && (
                  <View className="pb-4">
                    <RatingSelector
                      selectedValue={getFilterValue("minRating") as string | undefined}
                      onChange={(val) => updateFilter("minRating", val)}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Status Section */}
            {getFilterConfig("status") && (
              <View className="border-b border-border-default">
                <SectionHeader
                  title="Status"
                  isExpanded={expandedSections.status}
                  onToggle={() => toggleSection("status")}
                  badgeCount={getActiveCount("status")}
                />
                {expandedSections.status && (
                  <View className="pb-4">
                    <StatusSelector
                      options={getFilterConfig("status")?.options || []}
                      selectedValue={getFilterValue("status") as string | undefined}
                      onChange={(val) => updateFilter("status", val)}
                    />
                  </View>
                )}
              </View>
            )}

            <View className="h-24" />
          </ScrollView>

          {/* Footer */}
          <View className="absolute bottom-0 left-0 right-0 border-t border-border-default bg-bg-primary px-5 py-4">
            <View className="flex-row gap-3">
              <Button
                label="Clear"
                variant="secondary"
                onPress={handleClear}
                className="flex-1"
              />
              <Button
                label={hasChanges ? "Apply" : "Close"}
                variant="primary"
                onPress={hasChanges ? handleApply : onClose}
                className="flex-1"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

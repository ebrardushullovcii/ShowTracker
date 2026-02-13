import { useState, useCallback } from "react";
import { Modal, Pressable, Text, View, ScrollView, Animated } from "react-native";
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

// Collapsible Section Component
function FilterSection({
  title,
  children,
  isExpanded,
  onToggle,
  badgeCount = 0,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badgeCount?: number;
}) {
  return (
    <View className="border-b border-border-default">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-5 py-4"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-bold text-text-primary">
            {title}
          </Text>
          {badgeCount > 0 && (
            <View className="rounded-full bg-primary px-2 py-0.5">
              <Text className="text-xs font-bold text-white">{badgeCount}</Text>
            </View>
          )}
        </View>
        <Text className="text-xl text-text-secondary">
          {isExpanded ? "−" : "+"}
        </Text>
      </Pressable>
      
      {isExpanded && (
        <View className="px-5 pb-5">
          {children}
        </View>
      )}
    </View>
  );
}

// Compact Chip Grid for Genres
function GenreGrid({
  options,
  selectedValues,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const toggleGenre = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  // Show only first 8 genres, rest in "more"
  const [showAll, setShowAll] = useState(false);
  const displayOptions = showAll ? options : options.slice(0, 8);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {displayOptions.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleGenre(option.value)}
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
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      
      {options.length > 8 && (
        <Pressable
          onPress={() => setShowAll(!showAll)}
          className="mt-3 self-start"
        >
          <Text className="text-sm font-semibold text-primary">
            {showAll ? "Show Less" : `+${options.length - 8} More Genres`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Year Selector with Compact View
function YearSelector({
  options,
  selectedValue,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  const decades = [
    { label: "2020s", start: 2020, end: 2029 },
    { label: "2010s", start: 2010, end: 2019 },
    { label: "2000s", start: 2000, end: 2009 },
    { label: "1990s", start: 1990, end: 1999 },
    { label: "Older", start: 1950, end: 1989 },
  ];

  const [selectedDecade, setSelectedDecade] = useState<string | null>(null);

  const getYearsInDecade = (decade: typeof decades[0]) => {
    return options.filter((opt) => {
      const year = parseInt(opt.value);
      return year >= decade.start && year <= decade.end;
    }).slice(0, 10); // Show max 10 years per decade
  };

  return (
    <View>
      {/* Decade selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ gap: 8 }}
      >
        <Pressable
          onPress={() => {
            onChange("");
            setSelectedDecade(null);
          }}
          className={`rounded-full border px-4 py-2 ${
            !selectedValue
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              !selectedValue ? "text-white" : "text-text-secondary"
            }`}
          >
            All Years
          </Text>
        </Pressable>
        
        {decades.map((decade) => (
          <Pressable
            key={decade.label}
            onPress={() => setSelectedDecade(decade.label)}
            className={`rounded-full border px-4 py-2 ${
              selectedDecade === decade.label
                ? "border-primary bg-primary"
                : "border-border-default bg-bg-surface"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                selectedDecade === decade.label
                  ? "text-white"
                  : "text-text-secondary"
              }`}
            >
              {decade.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Year grid for selected decade */}
      {selectedDecade && (
        <View className="rounded-xl bg-bg-surface p-3">
          <View className="flex-row flex-wrap gap-2">
            {getYearsInDecade(
              decades.find((d) => d.label === selectedDecade)!
            ).map((year) => (
              <Pressable
                key={year.value}
                onPress={() => onChange(year.value)}
                className={`rounded-lg border px-3 py-2 ${
                  selectedValue === year.value
                    ? "border-primary bg-primary"
                    : "border-border-default bg-bg-primary"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedValue === year.value
                      ? "text-white"
                      : "text-text-secondary"
                  }`}
                >
                  {year.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      
      {/* Show selected year if not in a decade */}
      {selectedValue && !selectedDecade && (
        <View className="rounded-xl bg-bg-surface p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-text-primary">
              {selectedValue}
            </Text>
            <Pressable
              onPress={() => onChange("")}
              className="rounded-full bg-border-default px-2 py-1"
            >
              <Text className="text-xs">✕</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// Rating Selector
function RatingSelector({
  options,
  selectedValue,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => onChange("")}
        className={`flex-1 rounded-xl border px-4 py-3 ${
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
          Any Rating
        </Text>
      </Pressable>
      
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={`flex-1 rounded-xl border px-4 py-3 ${
            selectedValue === option.value
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold ${
              selectedValue === option.value
                ? "text-white"
                : "text-text-secondary"
            }`}
          >
            {option.label}
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
        className={`rounded-lg border px-4 py-2.5 ${
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
          Any Status
        </Text>
      </Pressable>
      
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={`rounded-lg border px-4 py-2.5 ${
            selectedValue === option.value
              ? "border-primary bg-primary"
              : "border-border-default bg-bg-surface"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              selectedValue === option.value
                ? "text-white"
                : "text-text-secondary"
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

  const getFilterValue = (filter: FilterConfig): string | string[] | undefined => {
    const value = localFilters[filter.id as keyof ActiveFilters];
    if (filter.id === "year" || filter.id === "minRating") {
      return value !== undefined ? String(value) : undefined;
    }
    return value as string | string[] | undefined;
  };

  const getActiveCountForFilter = (filter: FilterConfig): number => {
    const value = localFilters[filter.id as keyof ActiveFilters];
    if (Array.isArray(value)) return value.length;
    return value !== undefined ? 1 : 0;
  };

  const hasChanges = JSON.stringify(localFilters) !== JSON.stringify(activeFilters);

  const totalActiveFilters = Object.values(localFilters).reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    return value !== undefined ? count + 1 : count;
  }, 0);

  const renderFilterContent = (filter: FilterConfig) => {
    const value = getFilterValue(filter);
    
    switch (filter.id) {
      case "genres":
        return (
          <GenreGrid
            options={filter.options || []}
            selectedValues={(value as string[]) || []}
            onChange={(values) => updateFilter(filter.id, values)}
          />
        );
      case "year":
        return (
          <YearSelector
            options={filter.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => updateFilter(filter.id, val)}
          />
        );
      case "minRating":
        return (
          <RatingSelector
            options={filter.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => updateFilter(filter.id, val)}
          />
        );
      case "status":
        return (
          <StatusSelector
            options={filter.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => updateFilter(filter.id, val)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Solid Backdrop */}
        <Pressable 
          className="flex-1 bg-black/60" 
          onPress={onClose}
        />

        {/* Sheet Content - No Transparency */}
        <View className="max-h-[90%] overflow-hidden rounded-t-3xl bg-bg-primary shadow-2xl">
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2 bg-bg-primary">
            <View className="h-1 w-12 rounded-full bg-border-default" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border-default bg-bg-primary px-5 py-4">
            <View>
              <Text className="text-xl font-black text-text-primary">
                Filters
              </Text>
              {totalActiveFilters > 0 && (
                <Text className="mt-0.5 text-sm text-primary font-semibold">
                  {totalActiveFilters} selected
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              className="rounded-full bg-bg-surface px-4 py-2 border border-border-default"
            >
              <Text className="text-sm font-bold text-text-secondary">
                Close
              </Text>
            </Pressable>
          </View>

          {/* Filter Content */}
          <ScrollView 
            className="bg-bg-primary"
            showsVerticalScrollIndicator={false}
          >
            {filters.map((filter) => (
              <FilterSection
                key={filter.id}
                title={filter.label}
                isExpanded={expandedSections[filter.id] ?? false}
                onToggle={() => toggleSection(filter.id)}
                badgeCount={getActiveCountForFilter(filter)}
              >
                {renderFilterContent(filter)}
              </FilterSection>
            ))}
            <View className="h-32" />
          </ScrollView>

          {/* Footer Actions */}
          <View className="absolute bottom-0 left-0 right-0 border-t-2 border-border-default bg-bg-primary px-5 py-4 shadow-lg">
            <View className="flex-row gap-3">
              <Button
                label="Clear All"
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

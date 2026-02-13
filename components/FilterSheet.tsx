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

// Chip component for selectable options
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
      className={`rounded-full border px-4 py-2.5 ${
        isSelected
          ? "border-primary bg-primary"
          : "border-border-default bg-bg-surface/50"
      }`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Text
        className={`text-xs font-semibold ${
          isSelected ? "text-white" : "text-text-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Year selector with horizontal scroll
function YearSelector({
  options,
  selectedValue,
  onChange,
}: {
  options: { value: string; label: string }[];
  selectedValue?: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4 px-4"
      contentContainerStyle={{ gap: 8, paddingRight: 32 }}
    >
      <Pressable
        onPress={() => onChange("")}
        className={`rounded-full border px-5 py-2.5 ${
          !selectedValue
            ? "border-primary bg-primary"
            : "border-border-default bg-bg-surface/50"
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            !selectedValue ? "text-white" : "text-text-secondary"
          }`}
        >
          Any Year
        </Text>
      </Pressable>
      {options.slice(0, 20).map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          isSelected={selectedValue === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ScrollView>
  );
}

// Rating selector with stars
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
    <View className="flex-row flex-wrap gap-2">
      <Pressable
        onPress={() => onChange("")}
        className={`rounded-full border px-5 py-2.5 ${
          !selectedValue
            ? "border-primary bg-primary"
            : "border-border-default bg-bg-surface/50"
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            !selectedValue ? "text-white" : "text-text-secondary"
          }`}
        >
          Any Rating
        </Text>
      </Pressable>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          isSelected={selectedValue === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

// Genre grid for better space usage
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

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          isSelected={selectedValues.includes(option.value)}
          onPress={() => toggleGenre(option.value)}
        />
      ))}
    </View>
  );
}

// Status selector
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
        className={`rounded-full border px-5 py-2.5 ${
          !selectedValue
            ? "border-primary bg-primary"
            : "border-border-default bg-bg-surface/50"
        }`}
      >
        <Text
          className={`text-xs font-semibold ${
            !selectedValue ? "text-white" : "text-text-secondary"
          }`}
        >
          Any Status
        </Text>
      </Pressable>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          isSelected={selectedValue === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

// Individual filter section
function FilterSection({
  config,
  value,
  onChange,
}: {
  config: FilterConfig;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const renderFilterInput = () => {
    switch (config.id) {
      case "genres":
        return (
          <GenreGrid
            options={config.options || []}
            selectedValues={(value as string[]) || []}
            onChange={(values) => onChange(values)}
          />
        );
      case "year":
        return (
          <YearSelector
            options={config.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => onChange(val)}
          />
        );
      case "minRating":
        return (
          <RatingSelector
            options={config.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => onChange(val)}
          />
        );
      case "status":
        return (
          <StatusSelector
            options={config.options || []}
            selectedValue={value as string | undefined}
            onChange={(val) => onChange(val)}
          />
        );
      default:
        return (
          <View className="flex-row flex-wrap gap-2">
            {config.options?.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                isSelected={
                  Array.isArray(value)
                    ? value.includes(option.value)
                    : value === option.value
                }
                onPress={() => onChange(option.value)}
              />
            ))}
          </View>
        );
    }
  };

  return (
    <View className="mb-6">
      <Text className="mb-3 text-xs font-black uppercase tracking-widest text-primary">
        {config.label}
      </Text>
      {renderFilterInput()}
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

  // Reset local filters when sheet opens
  const handleOpen = useCallback(() => {
    setLocalFilters(activeFilters);
  }, [activeFilters, isVisible]);

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

  const getFilterValue = (
    filter: FilterConfig
  ): string | string[] | undefined => {
    const value = localFilters[filter.id as keyof ActiveFilters];
    if (filter.id === "year" || filter.id === "minRating") {
      return value !== undefined ? String(value) : undefined;
    }
    return value as string | string[] | undefined;
  };

  const hasChanges =
    JSON.stringify(localFilters) !== JSON.stringify(activeFilters);

  const activeFilterCount = Object.values(localFilters).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined;
  }).length;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View className="flex-1 justify-end bg-black/80">
        {/* Backdrop */}
        <Pressable className="flex-1" onPress={onClose} />

        {/* Sheet Content */}
        <View className="max-h-[85%] overflow-hidden rounded-t-3xl border-t-2 border-border-bright bg-bg-primary shadow-2xl">
          {/* Handle bar */}
          <View className="items-center pt-3 pb-1">
            <View className="h-1.5 w-12 rounded-full bg-border-default" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b-2 border-border-default px-5 py-4">
            <View>
              <Text className="text-xl font-black text-text-primary">
                Filters
              </Text>
              {activeFilterCount > 0 && (
                <Text className="mt-0.5 text-xs text-primary">
                  {activeFilterCount} active
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              className="rounded-full bg-bg-surface px-4 py-2"
            >
              <Text className="text-sm font-bold text-text-secondary">
                Close
              </Text>
            </Pressable>
          </View>

          {/* Filter Content */}
          <ScrollView className="px-5 py-5" showsVerticalScrollIndicator={false}>
            {filters.map((filter) => (
              <FilterSection
                key={filter.id}
                config={filter}
                value={getFilterValue(filter)}
                onChange={(value) => updateFilter(filter.id, value)}
              />
            ))}
            <View className="h-8" />
          </ScrollView>

          {/* Footer Actions */}
          <View className="border-t-2 border-border-default bg-bg-surface/50 px-5 py-4">
            <View className="flex-row gap-3">
              <Button
                label="Clear All"
                variant="secondary"
                onPress={handleClear}
                className="flex-1"
              />
              <Button
                label={hasChanges ? "Apply Filters" : "Close"}
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

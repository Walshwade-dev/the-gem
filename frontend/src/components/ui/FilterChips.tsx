// ============================================================================
// The Gem: Filter Chips Component
// Pill-shaped filter chips with active/inactive stroke states from design reference
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { THEME } from '../../constants/theme';

export interface FilterChipOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: FilterChipOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isDarkMode?: boolean;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  options,
  selectedId,
  onSelect,
  isDarkMode = false,
}) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.chip,
              isDarkMode && styles.chipDark,
              isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipSelected),
            ]}
            onPress={() => onSelect(option.id)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.chipText,
                isDarkMode && styles.chipTextDark,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {option.label}
            </Text>
            {option.count !== undefined && (
              <View
                style={[
                  styles.countPill,
                  isSelected && styles.countPillSelected,
                  isDarkMode && styles.countPillDark,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isSelected && styles.countTextSelected,
                  ]}
                >
                  {option.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chipDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  chipSelected: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chipSelectedDark: {
    backgroundColor: '#0D9488',
    borderColor: '#99F6E4',
  },
  chipText: {
    fontSize: THEME.typography.caption.fontSize,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextDark: {
    color: '#CFE9EC',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countPillDark: {
    backgroundColor: '#1B4F55',
  },
  countPillSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  countTextSelected: {
    color: '#FFFFFF',
  },
});

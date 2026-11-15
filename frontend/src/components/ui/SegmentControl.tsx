// ============================================================================
// The Gem: Segmented Control Component
// Pill-shaped segmented tabs with active state indicator from design reference
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface SegmentControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  isDarkMode?: boolean;
}

export function SegmentControl<T extends string = string>({
  options,
  activeId,
  onChange,
  isDarkMode = false,
}: SegmentControlProps<T>) {
  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.segment,
              isActive && (isDarkMode ? styles.segmentActiveDark : styles.segmentActive),
            ]}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.label,
                isDarkMode && { color: '#CFE9EC' },
                isActive && (isDarkMode ? styles.labelActiveDark : styles.labelActive),
              ]}
            >
              {opt.label}
            </Text>
            {opt.count !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  isActive && styles.countBadgeActive,
                  isDarkMode && { backgroundColor: '#164247' },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    isActive && styles.countTextActive,
                    isDarkMode && { color: '#F0FDFA' },
                  ]}
                >
                  {opt.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.borderRadius.md, // 12px
    padding: 3,
    marginHorizontal: 14,
    marginVertical: 8,
  },
  containerDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.45)',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm, // 8px
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentActiveDark: {
    backgroundColor: '#256A71',
    borderWidth: 0.75,
    borderColor: '#7AB5BC',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.3,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  labelActive: {
    color: '#0891B2',
    fontWeight: '700',
  },
  labelActiveDark: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeActive: {
    backgroundColor: '#ECFEFF',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  countTextActive: {
    color: '#0891B2',
  },
});

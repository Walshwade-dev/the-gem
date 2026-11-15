// ============================================================================
// The Gem: Liquid Glass Bottom Navigation Bar
// Mimics frosted translucent glass dock with smooth pill active indicators
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../constants/theme';

export type MainAppTab = 'sales' | 'catalog' | 'credits' | 'profile';

interface LiquidGlassBottomBarProps {
  activeTab: MainAppTab;
  onTabChange: (tab: MainAppTab) => void;
  isDarkMode?: boolean;
  creditBadgeCount?: number;
}

export const LiquidGlassBottomBar: React.FC<LiquidGlassBottomBarProps> = ({
  activeTab,
  onTabChange,
  isDarkMode = false,
  creditBadgeCount = 0,
}) => {
  const insets = useSafeAreaInsets();

  const tabs: { id: MainAppTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'sales', label: 'Sales', icon: 'flash-outline', activeIcon: 'flash' },
    { id: 'catalog', label: 'Products', icon: 'cube-outline', activeIcon: 'cube' },
    { id: 'credits', label: 'Ledger', icon: 'book-outline', activeIcon: 'book' },
    { id: 'profile', label: 'Profile', icon: 'person-circle-outline', activeIcon: 'person-circle' },
  ];

  const [dockWidth, setDockWidth] = useState(0);
  const [clickedLabel, setClickedLabel] = useState<string | null>(null);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab));
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(6)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      tension: 75,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slideAnim]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleTabPress = (tab: { id: MainAppTab; label: string }) => {
    onTabChange(tab.id);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setClickedLabel(tab.label);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(6);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 4,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setClickedLabel(null);
      });
    }, 900);
  };

  // paddingHorizontal (4 * 2 = 8)
  const pillWidth = dockWidth > 8 ? (dockWidth - 8) / tabs.length : 0;
  const pillTranslateX = slideAnim.interpolate({
    inputRange: tabs.map((_, idx) => idx),
    outputRange: tabs.map((_, idx) => idx * pillWidth),
  });

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
      {clickedLabel ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.momentaryLabelPill,
            isDarkMode && styles.momentaryLabelPillDark,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Text style={[styles.momentaryLabelText, isDarkMode && { color: '#F0FDFA' }]}>
            {clickedLabel}
          </Text>
        </Animated.View>
      ) : null}

      <View
        style={[styles.glassDock, isDarkMode && styles.glassDockDark]}
        onLayout={(e) => setDockWidth(e.nativeEvent.layout.width)}
      >
        {pillWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              isDarkMode && styles.activePillDark,
              {
                width: pillWidth,
                transform: [{ translateX: pillTranslateX }],
              },
            ]}
          />
        )}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.75}
              accessibilityLabel={tab.label}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={21}
                  color={
                    isActive
                      ? '#FFFFFF'
                      : (isDarkMode ? '#CFE9EC' : '#64748B')
                  }
                />
                {tab.id === 'credits' && creditBadgeCount > 0 && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>{creditBadgeCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 99,
  },
  glassDock: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 24,
    padding: 4,
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any) : {}),
  },
  glassDockDark: {
    backgroundColor: 'rgba(37, 106, 113, 0.88)',
    borderColor: '#7AB5BC',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.35,
  },
  activePill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
  },
  activePillDark: {
    backgroundColor: '#0891B2',
    borderWidth: 0.75,
    borderColor: 'rgba(240, 253, 250, 0.25)',
  },
  tabItem: {
    flex: 1,
    zIndex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  momentaryLabelPill: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  momentaryLabelPillDark: {
    backgroundColor: 'rgba(37, 106, 113, 0.96)',
    borderColor: '#7AB5BC',
  },
  momentaryLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});

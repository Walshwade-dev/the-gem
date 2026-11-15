// ============================================================================
// The Gem: Onion Sales Tracker - Header Component (Mobile-First)
// Merchant Turquoise Blue Branding with Faceted Onion Identity
// ============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface HeaderProps {
  onOpenCreditLedger?: () => void;
  onOpenNotifications?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCreditLedger,
  onOpenNotifications,
}) => {
  const insets = useSafeAreaInsets();
  const { customerCredits, isDarkMode, toggleTheme } = useAppStore(
    useShallow((s) => ({
      customerCredits: s.customerCredits,
      isDarkMode: s.isDarkMode,
      toggleTheme: s.toggleTheme,
    }))
  );

  const pendingCreditCount = useMemo(() => {
    let count = 0;
    for (const c of customerCredits) {
      for (const r of c.records) {
        if (r.approvalStatus === 'PENDING') count += 1;
      }
    }
    return count;
  }, [customerCredits]);

  return (
    <View
      style={[
        styles.container,
        isDarkMode && styles.containerDark,
        { paddingTop: Math.max(insets.top, 14) + 6 },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Brand Container with Faceted Onion Identity */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/faceted-onion-transparent.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandTextCol}>
            <Text style={styles.brandTitle}>The Gem</Text>
            <Text style={styles.marketSubtitle} numberOfLines={1}>
              Wakulima Market (Marikiti) • Nairobi
            </Text>
          </View>
        </View>

        {/* Quick Action Badges */}
        <View style={styles.actionsGroup}>
          {/* Notification Icon */}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={onOpenNotifications || onOpenCreditLedger}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
            {pendingCreditCount > 0 && (
              <View style={styles.notifBadgeCircle}>
                <Text style={styles.notifBadgeText}>{pendingCreditCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Quick Theme Toggle Icon */}
          <TouchableOpacity
            style={styles.themeToggleBtn}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={18}
              color={isDarkMode ? '#FCD34D' : '#E0F2FE'}
            />
          </TouchableOpacity>
        </View>
      </View>
      {isDarkMode && <View pointerEvents="none" style={styles.darkBottomBorderArc} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    position: 'relative',
  },
  containerDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
  },
  darkBottomBorderArc: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 0.75,
    borderLeftWidth: 0.75,
    borderRightWidth: 0.75,
    borderTopWidth: 0,
    borderColor: '#FDE68A',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 66,
    height: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  marketSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#E0F2FE',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0891B2',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// The Gem: Onion Sales Tracker - Header Component (Mobile-First)
// Merchant Turquoise Blue Branding with Adaptive Safe Area & Touch Ergonomics
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenCreditLedger: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth, onOpenCreditLedger }) => {
  const insets = useSafeAreaInsets();
  const { 
    role, 
    setRole, 
    currentBatch, 
    lockdown,
    customerCredits
  } = useAppStore();

  const totalOutstandingCredit = customerCredits.reduce(
    (sum, c) => sum + c.totalOutstandingCredit, 
    0
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
      {/* Top Brand & Actions Bar */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="diamond-stone" size={20} color="#FBBF24" />
            <MaterialCommunityIcons name="food-apple" size={14} color="#CFFAFE" style={styles.onionIcon} />
          </View>
          <View style={styles.brandTextCol}>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>The Gem</Text>
              <View style={styles.subBadge}>
                <Text style={styles.subBadgeText}>ONION TRACKER</Text>
              </View>
            </View>
            <Text style={styles.marketSubtitle} numberOfLines={1}>
              Wakulima Market (Marikiti) • Nairobi
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsGroup}>
          {role === 'MERCHANT' && (
            <TouchableOpacity 
              style={styles.creditPill}
              onPress={onOpenCreditLedger}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={13} color="#92400E" />
              <Text style={styles.creditPillText}>
                Ksh {(totalOutstandingCredit / 1000).toFixed(0)}k
              </Text>
            </TouchableOpacity>
          )}

          {/* Emergency Panic Lockdown Button */}
          <TouchableOpacity 
            style={styles.panicButton}
            onPress={() => lockdown('Manual Emergency Panic triggered by merchant')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-half" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Switcher & Auth Pill */}
      <View style={styles.roleBanner}>
        <View style={styles.roleToggleGroup}>
          <TouchableOpacity 
            style={[styles.roleTab, role === 'MERCHANT' && styles.roleTabActiveMerchant]}
            onPress={() => setRole('MERCHANT')}
          >
            <Ionicons 
              name="shield-checkmark" 
              size={13} 
              color={role === 'MERCHANT' ? '#FFFFFF' : '#CFFAFE'} 
            />
            <Text style={[styles.roleTabText, role === 'MERCHANT' && styles.roleTabTextActive]}>
              Merchant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleTab, role === 'SELLER' && styles.roleTabActiveSeller]}
            onPress={() => setRole('SELLER')}
          >
            <Ionicons 
              name="person" 
              size={13} 
              color={role === 'SELLER' ? '#FFFFFF' : '#CFFAFE'} 
            />
            <Text style={[styles.roleTabText, role === 'SELLER' && styles.roleTabTextActive]}>
              Seller
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Session Badge */}
        <TouchableOpacity style={styles.userBadge} onPress={onOpenAuth}>
          <Ionicons name="call" size={11} color="#E0F2FE" />
          <Text style={styles.userBadgeText}>OTP Active</Text>
        </TouchableOpacity>
      </View>

      {/* Truck Stay Day Tracker */}
      {currentBatch && (
        <View style={styles.dayTrackerRow}>
          <View style={[
            styles.dayNumberBadge,
            currentBatch.dayNumber === 5 && { backgroundColor: '#EF4444' }
          ]}>
            <Text style={[
              styles.dayNumberLabel,
              currentBatch.dayNumber === 5 && { color: '#FFFFFF' }
            ]}>
              {currentBatch.dayNumber === 5 ? 'DAY 5 (EXT)' : `DAY ${currentBatch.dayNumber} OF 4`}
            </Text>
          </View>
          <Text style={styles.dayStatusText} numberOfLines={1}>
            {currentBatch.dayNumber === 1 
              ? 'Day 1: Base NCC Cess (Nets Counted & Covered)' 
              : currentBatch.dayNumber === 5
                ? 'Day 5: Negotiated Extension • Flat Ksh 1,000'
                : `Day ${currentBatch.dayNumber} of 4: Flat Ksh 1,000 (No Recount)`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: THEME.borderRadius.xl,
    borderBottomRightRadius: THEME.borderRadius.xl,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    position: 'relative',
  },
  onionIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  brandTextCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#451A03',
    letterSpacing: 0.3,
  },
  marketSubtitle: {
    fontSize: 11,
    color: '#E0F2FE',
    fontWeight: '500',
    marginTop: 1,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  creditPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  panicButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F87171',
  },
  roleBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 78, 99, 0.45)', // Deep turquoise translucent
    padding: 5,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 8,
  },
  roleToggleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  roleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roleTabActiveMerchant: {
    backgroundColor: '#164E63', // Deep turquoise teal
  },
  roleTabActiveSeller: {
    backgroundColor: '#D97706', // Amber gold
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CFFAFE',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  userBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTrackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 8,
  },
  dayNumberBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dayNumberLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#451A03',
  },
  dayStatusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  }
});

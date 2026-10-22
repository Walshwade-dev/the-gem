// ============================================================================
// The Gem: Onion Sales Tracker - Header Component
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenCreditLedger: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth, onOpenCreditLedger }) => {
  const { 
    role, 
    setRole, 
    currentBatch, 
    currentUserName, 
    lockdown,
    customerCredits
  } = useAppStore();

  const totalOutstandingCredit = customerCredits.reduce(
    (sum, c) => sum + c.totalOutstandingCredit, 
    0
  );

  return (
    <View style={styles.container}>
      {/* Top Brand & Status Row */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="diamond-stone" size={20} color="#FBBF24" />
            <MaterialCommunityIcons name="food-apple" size={16} color="#FFE4E6" style={styles.onionIcon} />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>The Gem</Text>
              <View style={styles.subBadge}>
                <Text style={styles.subBadgeText}>ONION TRACKER</Text>
              </View>
            </View>
            <Text style={styles.marketSubtitle}>Wakulima Market (Marikiti) • Nairobi</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsGroup}>
          {/* Madeni (Credit) Badge - Clickable */}
          {role === 'MERCHANT' && (
            <TouchableOpacity 
              style={styles.creditPill}
              onPress={onOpenCreditLedger}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={14} color="#B45309" />
              <Text style={styles.creditPillText}>
                Deni: Ksh {(totalOutstandingCredit / 1000).toFixed(0)}k
              </Text>
            </TouchableOpacity>
          )}

          {/* Emergency Panic Lockdown Button */}
          <TouchableOpacity 
            style={styles.panicButton}
            onPress={() => lockdown('Manual Emergency Panic triggered by user')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-half" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Switcher & Operational Banner */}
      <View style={styles.roleBanner}>
        {/* Role Toggle Selector */}
        <View style={styles.roleToggleGroup}>
          <TouchableOpacity 
            style={[styles.roleTab, role === 'MERCHANT' && styles.roleTabActiveMerchant]}
            onPress={() => setRole('MERCHANT')}
          >
            <Ionicons 
              name="shield-checkmark" 
              size={14} 
              color={role === 'MERCHANT' ? '#FFFFFF' : THEME.colors.textSecondary} 
            />
            <Text style={[styles.roleTabText, role === 'MERCHANT' && styles.roleTabTextActive]}>
              Merchant (Owner)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleTab, role === 'SELLER' && styles.roleTabActiveSeller]}
            onPress={() => setRole('SELLER')}
          >
            <Ionicons 
              name="person" 
              size={14} 
              color={role === 'SELLER' ? '#FFFFFF' : THEME.colors.textSecondary} 
            />
            <Text style={[styles.roleTabText, role === 'SELLER' && styles.roleTabTextActive]}>
              Hired Seller
            </Text>
          </TouchableOpacity>
        </View>

        {/* Current Active User / Auth Button */}
        <TouchableOpacity style={styles.userBadge} onPress={onOpenAuth}>
          <Ionicons name="call-outline" size={12} color={THEME.colors.textSecondary} />
          <Text style={styles.userBadgeText} numberOfLines={1}>
            {role === 'MERCHANT' ? 'Merchant' : 'Seller'}: OTP Verified
          </Text>
        </TouchableOpacity>
      </View>

      {/* Truck Stay Day Tracker */}
      {currentBatch && (
        <View style={styles.dayTrackerRow}>
          <View style={styles.dayNumberBadge}>
            <Text style={styles.dayNumberLabel}>
              DAY {currentBatch.dayNumber} OF 4
            </Text>
          </View>
          <Text style={styles.dayStatusText}>
            {currentBatch.dayNumber === 1 
              ? 'First Day at Market • Base NCC Cess Covered' 
              : `Consecutive Day • Demurrage: Ksh ${(currentBatch.dayNumber - 1) * 1000} incurred`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.primary,
    paddingTop: 48,
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomLeftRadius: THEME.borderRadius.xl,
    borderBottomRightRadius: THEME.borderRadius.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    position: 'relative',
  },
  onionIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: THEME.typography.sizes['2xl'],
    fontWeight: THEME.typography.weights.heavy,
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
    fontSize: 9,
    fontWeight: '800',
    color: '#451A03',
  },
  marketSubtitle: {
    fontSize: THEME.typography.sizes.xs,
    color: '#FECDD3',
    fontWeight: THEME.typography.weights.medium,
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  creditPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  panicButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 6,
    borderRadius: THEME.borderRadius.lg,
    marginBottom: THEME.spacing.sm,
  },
  roleToggleGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  roleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.borderRadius.md,
  },
  roleTabActiveMerchant: {
    backgroundColor: '#059669', // Emerald green for merchant
  },
  roleTabActiveSeller: {
    backgroundColor: '#D97706', // Amber gold for seller
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  roleTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userBadgeText: {
    fontSize: 10,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  dayTrackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 2,
    gap: 8,
  },
  dayNumberBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dayNumberLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#451A03',
  },
  dayStatusText: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '500',
    flex: 1,
  }
});

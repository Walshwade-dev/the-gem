// ============================================================================
// The Gem: Truck Batch & Produce Overview Card
// Wakulima Market Entry, NCC Cess, Stock Breakdown & Origin Tracking
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface BatchOverviewCardProps {
  onOpenNewBatchModal: () => void;
  onOpenSellerModal: () => void;
}

export const BatchOverviewCard: React.FC<BatchOverviewCardProps> = ({ 
  onOpenNewBatchModal,
  onOpenSellerModal
}) => {
  const { currentBatch, role, advanceBatchDay } = useAppStore();

  if (!currentBatch) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="truck-fast" size={48} color={THEME.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Active Truck Batch</Text>
        <Text style={styles.emptySubtitle}>
          Register the arriving truck at Wakulima Market (05:00 AM) to begin sales.
        </Text>
        {role === 'MERCHANT' && (
          <TouchableOpacity style={styles.createButton} onPress={onOpenNewBatchModal}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Register Arriving Truck</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const g1Percent = Math.round((currentBatch.remainingGrade1Nets / currentBatch.initialGrade1Nets) * 100);
  const g2Percent = Math.round((currentBatch.remainingGrade2Nets / currentBatch.initialGrade2Nets) * 100);

  const handleShareAdvert = () => {
    Alert.alert(
      'Social Media / WhatsApp Advert',
      `Ready to broadcast stock from ${currentBatch.origin.regionName}!\n\n"Fresh batch of premium cured red onions just arrived at Wakulima Market! Grade 1 & Grade 2 available now. Call/WhatsApp for wholesale orders!"`,
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  const handleAdvanceDay = () => {
    if (currentBatch.dayNumber >= 5) {
      Alert.alert(
        'Maximum Stay Reached', 
        'This truck has completed 5 days (including the negotiated extension). Market rules require closing the batch and dispatching the truck.'
      );
      return;
    }

    const nextDay = currentBatch.dayNumber + 1;
    const isDay5 = nextDay === 5;

    Alert.alert(
      isDay5 ? 'Advance to Day 5 (Negotiated Extension)?' : `Advance to Day ${nextDay}?`,
      isDay5
        ? `Standard stay is 4 days, but Day 5 is permitted through negotiation.\n\nMoving to Day 5 will record:\n• NCC Flat Fee: Ksh 1,000 (No net recount)\n• Watchman Security: Ksh 100\n• Bay Sanitation: Ksh 100`
        : `Moving to Day ${nextDay} will record:\n• NCC Daily Flat Fee: Ksh 1,000 (No net recount by NCC officials)\n• Watchman Security: Ksh 100\n• Bay Cleaners: Ksh 100`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Advance', onPress: () => advanceBatchDay() }
      ]
    );
  };

  return (
    <View style={styles.card}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View>
          <View style={styles.batchBadgeRow}>
            <Text style={styles.batchNumber}>{currentBatch.batchNumber}</Text>
            <View style={styles.plateBadge}>
              <Ionicons name="car" size={12} color="#1E293B" />
              <Text style={styles.plateText}>{currentBatch.truckPlate}</Text>
            </View>
          </View>
          <Text style={styles.arrivalText}>
            {currentBatch.dayNumber === 1
              ? `Day 1 Entry: NCC Cess Ksh ${currentBatch.nccCessPaid.toLocaleString()} (${currentBatch.nccDeclaredNets} nets counted)`
              : `Day ${currentBatch.dayNumber} at Bay • NCC Flat Fee: Ksh 1,000/day (No Recount)`}
          </Text>
        </View>

        {role === 'MERCHANT' && (
          <View style={styles.headerActionRow}>
            <TouchableOpacity 
              style={styles.advanceDayBtn} 
              onPress={handleAdvanceDay}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={14} color="#881337" />
              <Text style={styles.advanceDayBtnText}>+ Day</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sellerAssignBtn} 
              onPress={onOpenSellerModal}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={14} color="#059669" />
              <Text style={styles.sellerAssignBtnText}>Assign Seller</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Origin Section: Role-Protected */}
      <View style={styles.originCard}>
        <View style={styles.originHeader}>
          <Ionicons 
            name={role === 'MERCHANT' ? "location" : "lock-closed"} 
            size={16} 
            color={role === 'MERCHANT' ? THEME.colors.primary : THEME.colors.textMuted} 
          />
          <Text style={styles.originLabel}>
            {role === 'MERCHANT' ? 'PRODUCE ORIGIN & REGION' : 'PRODUCE ORIGIN (RESTRICTED)'}
          </Text>
        </View>

        {role === 'MERCHANT' ? (
          <View>
            <Text style={styles.originRegionText}>{currentBatch.origin.regionName}</Text>
            <Text style={styles.originLocationText}>
              Specific Locality: <Text style={styles.boldText}>{currentBatch.origin.specificLocation}</Text>
            </Text>
            {currentBatch.origin.farmerSupplierNotes && (
              <Text style={styles.originNotesText}>
                Quality Note: {currentBatch.origin.farmerSupplierNotes}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.sellerRestrictedText}>
            Wholesale farm origin, cost details, and supplier contacts are hidden for seller privacy.
          </Text>
        )}
      </View>

      {/* Dual Grade Stock Progress */}
      <View style={styles.stockSection}>
        <Text style={styles.sectionTitle}>CURRENT STOCK AT BAY</Text>
        
        {/* Grade 1 */}
        <View style={styles.stockItem}>
          <View style={styles.stockItemHeader}>
            <View style={styles.gradeTitleRow}>
              <View style={[styles.gradeTag, { backgroundColor: '#881337' }]}>
                <Text style={styles.gradeTagText}>G1</Text>
              </View>
              <View>
                <Text style={styles.gradeName}>Grade 1 (Kubwa / Premium)</Text>
                <Text style={styles.gradeSubtitle}>Large bulbs, cured, firm</Text>
              </View>
            </View>
            <Text style={styles.stockCountText}>
              <Text style={styles.stockCountBold}>{currentBatch.remainingGrade1Nets}</Text>
              <Text style={styles.stockCountTotal}> / {currentBatch.initialGrade1Nets} nets</Text>
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${g1Percent}%`, backgroundColor: '#881337' }]} />
          </View>
        </View>

        {/* Grade 2 */}
        <View style={styles.stockItem}>
          <View style={styles.stockItemHeader}>
            <View style={styles.gradeTitleRow}>
              <View style={[styles.gradeTag, { backgroundColor: '#D97706' }]}>
                <Text style={styles.gradeTagText}>G2</Text>
              </View>
              <View>
                <Text style={styles.gradeName}>Grade 2 (Ndogo / Wastani)</Text>
                <Text style={styles.gradeSubtitle}>Medium/small bulbs, fast retail</Text>
              </View>
            </View>
            <Text style={styles.stockCountText}>
              <Text style={styles.stockCountBold}>{currentBatch.remainingGrade2Nets}</Text>
              <Text style={styles.stockCountTotal}> / {currentBatch.initialGrade2Nets} nets</Text>
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${g2Percent}%`, backgroundColor: '#D97706' }]} />
          </View>
        </View>
      </View>

      {/* Visual Quality Catalog & Social Media Advert */}
      {currentBatch.photoUrls.length > 0 && (
        <View style={styles.photoHub}>
          <View style={styles.photoHeaderRow}>
            <Text style={styles.photoHeaderTitle}>PRODUCE PHOTOS & QUALITY LOG</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareAdvert}>
              <Ionicons name="logo-whatsapp" size={14} color="#15803D" />
              <Text style={styles.shareBtnText}>Advert / Social</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {currentBatch.photoUrls.map((url, idx) => (
              <View key={idx} style={styles.photoWrapper}>
                <Image source={{ uri: url }} style={styles.photoThumb} />
                <View style={styles.photoIndexBadge}>
                  <Text style={styles.photoIndexText}>#{idx + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    marginHorizontal: THEME.spacing.lg,
    marginTop: -THEME.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyContainer: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing['2xl'],
    margin: THEME.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.sm,
  },
  emptySubtitle: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: THEME.spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: THEME.borderRadius.md,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  batchBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchNumber: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  plateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  arrivalText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  headerActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  advanceDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  advanceDayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#881337',
  },
  sellerAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  sellerAssignBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  originCard: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: THEME.spacing.md,
  },
  originHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  originLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  originRegionText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  originLocationText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  originNotesText: {
    fontSize: 11,
    color: '#059669',
    fontStyle: 'italic',
    marginTop: 2,
  },
  sellerRestrictedText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  stockSection: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stockItem: {
    marginBottom: 10,
  },
  stockItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeTag: {
    width: 28,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeTagText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  gradeName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  gradeSubtitle: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  stockCountText: {
    fontSize: 12,
  },
  stockCountBold: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  stockCountTotal: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  photoHub: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shareBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  photoScroll: {
    flexDirection: 'row',
  },
  photoWrapper: {
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoThumb: {
    width: 80,
    height: 60,
    borderRadius: 6,
  },
  photoIndexBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoIndexText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  }
});

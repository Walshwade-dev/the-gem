// ============================================================================
// The Gem: Truck Batch & Current Stock Card (Sales Page)
// Displays ONLY Stock ID Batch, Truck Registration, and Current Grade Stock
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { confirmAndRevokeAssignment } from '../utils/revokeAssignmentPrompt';

interface BatchOverviewCardProps {
  onOpenNewBatchModal?: () => void;
}

export const BatchOverviewCard: React.FC<BatchOverviewCardProps> = ({ 
  onOpenNewBatchModal 
}) => {
  const { currentBatch, role, allocations, currentUserId, currentUserName, isDarkMode, batchProducts, revokeSellerAssignment } = useAppStore(
    useShallow((s) => ({
      currentBatch: s.currentBatch,
      role: s.role,
      allocations: s.allocations,
      currentUserId: s.currentUserId,
      currentUserName: s.currentUserName,
      isDarkMode: s.isDarkMode,
      batchProducts: s.batchProducts,
      revokeSellerAssignment: s.revokeSellerAssignment,
    }))
  );

  const sellerAllocation = allocations?.find(
    (a) =>
      a.sellerId === currentUserId ||
      a.sellerName.toLowerCase().includes((currentUserName || '').toLowerCase()) ||
      (currentUserName || '').toLowerCase().includes(a.sellerName.toLowerCase())
  ) || allocations?.[0];

  // If there is no product in products, there is no existing product stock batch in sales
  if (!currentBatch || !batchProducts || batchProducts.length === 0) {
    return (
      <View style={[styles.emptyContainer, isDarkMode && styles.emptyContainerDark]}>
        <MaterialCommunityIcons
          name="cube-off-outline"
          size={44}
          color={isDarkMode ? '#B4D6D9' : THEME.colors.textMuted}
        />
        <Text style={[styles.emptyTitle, isDarkMode && { color: '#F0FDFA' }]}>
          No Product Stock Batch in Sales
        </Text>
        <Text style={[styles.emptySubtitle, isDarkMode && { color: '#CFE9EC' }]}>
          {role === 'MERCHANT'
            ? 'There is currently no product in the catalog. Add a product in the Products tab to create an active stock batch and start recording sales.'
            : 'Awaiting Master to onboard a product and allocate stock to your terminal.'}
        </Text>
        {role === 'MERCHANT' && onOpenNewBatchModal && (
          <TouchableOpacity style={styles.createButton} onPress={onOpenNewBatchModal} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.createButtonText}>+ Onboard Product in Products</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const isSeller = role === 'SELLER';

  const g1Allocated = sellerAllocation?.grade1Allocated || 0;
  const g1Sold = sellerAllocation?.grade1Sold || 0;
  const g1RemainingSeller = Math.max(0, g1Allocated - g1Sold);

  const g2Allocated = sellerAllocation?.grade2Allocated || 0;
  const g2Sold = sellerAllocation?.grade2Sold || 0;
  const g2RemainingSeller = Math.max(0, g2Allocated - g2Sold);

  const displayG1Remaining = isSeller ? g1RemainingSeller : currentBatch.remainingGrade1Nets;
  const displayG1Total = isSeller ? g1Allocated : currentBatch.initialGrade1Nets;

  const displayG2Remaining = isSeller ? g2RemainingSeller : currentBatch.remainingGrade2Nets;
  const displayG2Total = isSeller ? g2Allocated : currentBatch.initialGrade2Nets;

  const displayTotalRemaining = displayG1Remaining + displayG2Remaining;
  const batchAllocations = !isSeller
    ? (allocations || []).filter((a) => a.batchId === currentBatch.id)
    : [];

  const g1Percent = displayG1Total > 0 
    ? Math.round((displayG1Remaining / displayG1Total) * 100) 
    : 0;
  const g2Percent = displayG2Total > 0 
    ? Math.round((displayG2Remaining / displayG2Total) * 100) 
    : 0;

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      {/* 1. Stock ID Batch & Truck Reg */}
      <View style={[styles.batchInfoRow, isDarkMode && styles.batchInfoRowDark]}>
        <View style={styles.batchIdGroup}>
          <Text style={[styles.batchLabel, isDarkMode && { color: '#7DD3FC' }]}>STOCK ID BATCH</Text>
          <Text style={[styles.batchNumber, isDarkMode && styles.textWhite]}>
            {currentBatch.batchNumber}
          </Text>
          <Text style={[styles.truckPlateBelow, isDarkMode && { color: '#CFE9EC' }]}>
            {currentBatch.truckPlate}
          </Text>
        </View>
      </View>

      {!isSeller && batchAllocations.length > 0 && (
        <View style={{ gap: 6, marginBottom: 10 }}>
          {batchAllocations.map((a) => {
            const g1Left = Math.max(0, a.grade1Allocated - a.grade1Sold);
            const g2Left = Math.max(0, a.grade2Allocated - a.grade2Sold);
            return (
              <View
                key={a.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDarkMode ? '#1B4F55' : '#ECFEFF',
                  borderColor: isDarkMode ? 'rgba(122, 181, 188, 0.45)' : '#A5F3FC',
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                }}
              >
                <Ionicons name="person-circle-outline" size={16} color={isDarkMode ? '#5EEAD4' : '#0891B2'} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    fontWeight: '700',
                    color: isDarkMode ? '#F0FDFA' : '#0E7490',
                  }}
                  numberOfLines={2}
                >
                  Assigned to: {a.sellerName} ({g1Left} G1, {g2Left} G2 left)
                </Text>
                <TouchableOpacity
                  onPress={() => confirmAndRevokeAssignment(a, revokeSellerAssignment)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: isDarkMode ? '#3B181C' : '#FEF2F2',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#EF4444' : '#FECACA',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Ionicons name="return-down-back" size={12} color="#EF4444" />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Revoke</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* 2. Current Stock Progress & Counts */}
      <View style={styles.stockSection}>
        <View style={styles.stockHeaderRow}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.textWhite]}>
            {isSeller ? 'YOUR ASSIGNED STOCK' : 'CURRENT STOCK'}
          </Text>
          <Text style={styles.stockTotalSummary}>
            {displayTotalRemaining} Nets {isSeller ? 'Assigned' : 'Remaining'}
          </Text>
        </View>

        {/* Grade 1 */}
        <View style={styles.stockItem}>
          <View style={styles.stockItemHeader}>
            <View style={styles.gradeTitleRow}>
              <View style={[styles.gradeTag, { backgroundColor: '#0891B2' }]}>
                <Text style={styles.gradeTagText}>G1</Text>
              </View>
              <Text style={[styles.gradeName, isDarkMode && styles.textWhite]}>Grade 1</Text>
            </View>
            <Text style={styles.stockCountText}>
              <Text style={[styles.stockCountBold, isDarkMode && styles.textWhite]}>
                {displayG1Remaining}
              </Text>
              <Text style={styles.stockCountTotal}> / {displayG1Total} nets</Text>
            </Text>
          </View>
          <View style={[styles.progressBarBg, isDarkMode && styles.progressBarBgDark]}>
            <View style={[styles.progressBarFill, { width: `${Math.min(g1Percent, 100)}%`, backgroundColor: '#0891B2' }]} />
          </View>
        </View>

        {/* Grade 2 */}
        <View style={styles.stockItem}>
          <View style={styles.stockItemHeader}>
            <View style={styles.gradeTitleRow}>
              <View style={[styles.gradeTag, { backgroundColor: '#D97706' }]}>
                <Text style={styles.gradeTagText}>G2</Text>
              </View>
              <Text style={[styles.gradeName, isDarkMode && styles.textWhite]}>Grade 2</Text>
            </View>
            <Text style={styles.stockCountText}>
              <Text style={[styles.stockCountBold, isDarkMode && styles.textWhite]}>
                {displayG2Remaining}
              </Text>
              <Text style={styles.stockCountTotal}> / {displayG2Total} nets</Text>
            </Text>
          </View>
          <View style={[styles.progressBarBg, isDarkMode && styles.progressBarBgDark]}>
            <View style={[styles.progressBarFill, { width: `${Math.min(g2Percent, 100)}%`, backgroundColor: '#D97706' }]} />
          </View>
        </View>
      </View>

      {/* 3. Seller Assigned Quota & Custody Status (Single Source of Truth) */}
      {isSeller && (
        sellerAllocation ? (
          <View
            style={[
              styles.sellerStatusBanner,
              sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED' && styles.sellerStatusBannerGreen,
              sellerAllocation.acknowledgmentStatus === 'DISCREPANCY' && styles.sellerStatusBannerRed,
            ]}
          >
            <Ionicons
              name={
                sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED'
                  ? 'checkmark-circle'
                  : sellerAllocation.acknowledgmentStatus === 'DISCREPANCY'
                  ? 'warning'
                  : 'alert-circle'
              }
              size={13}
              color={
                sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED'
                  ? '#059669'
                  : sellerAllocation.acknowledgmentStatus === 'DISCREPANCY'
                  ? '#DC2626'
                  : '#D97706'
              }
            />
            <Text style={styles.sellerStatusBannerText}>
              Assigned: {sellerAllocation.grade1Allocated} G1 • {sellerAllocation.grade2Allocated} G2 nets •{' '}
              {sellerAllocation.acknowledgmentStatus === 'ACKNOWLEDGED'
                ? 'Custody Acknowledged'
                : sellerAllocation.acknowledgmentStatus === 'DISCREPANCY'
                ? 'Discrepancy Reported'
                : 'Pending Profile Acknowledgment'}
            </Text>
          </View>
        ) : (
          <View style={[styles.sellerStatusBanner, styles.sellerStatusBannerRed]}>
            <Ionicons name="alert-circle" size={13} color="#DC2626" />
            <Text style={styles.sellerStatusBannerText}>
              ⚠️ No stock allocated to you yet. Awaiting Master to assign your quota in Store Profile.
            </Text>
          </View>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  batchInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  batchInfoRowDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.25)',
  },
  batchIdGroup: {
    flex: 1,
  },
  batchLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  batchNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  truckPlateBelow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  stockSection: {
    paddingTop: 12,
  },
  stockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  stockTotalSummary: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  stockItem: {
    marginBottom: 12,
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
    gap: 6,
  },
  gradeTag: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  gradeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  stockCountText: {
    fontSize: 12,
  },
  stockCountBold: {
    fontWeight: '900',
    color: '#0F172A',
    fontSize: 13.5,
  },
  stockCountTotal: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarBgDark: {
    backgroundColor: '#1B4F55',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginHorizontal: 14,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyContainerDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  sellerStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sellerStatusBannerGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  sellerStatusBannerRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  sellerStatusBannerText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 14,
  },
});

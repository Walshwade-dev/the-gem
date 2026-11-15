// ============================================================================
// The Gem: Notifications & Live Staff Activity Modal
// Pops in when user taps the notification bell in the Header.
// Shows real-time business alerts (discrepancies, credit sign-offs, COB closure)
// AND comprehensive live staff activity audit logs for Master oversight.
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { StaffActivityLog } from '../../types';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToCredits?: () => void;
  onNavigateToReconciliation?: () => void;
  isDarkMode?: boolean;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  onNavigateToCredits,
  onNavigateToReconciliation,
  isDarkMode = false,
}) => {
  const {
    customerCredits,
    currentBatch,
    reconciliations,
    creditRepayments,
    role,
    activityLogs,
    stockDiscrepancyAlerts,
    resolveStockDiscrepancy,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'ALERTS' | 'AUDIT_LOG'>('ALERTS');
  const isMerchant = role === 'MERCHANT';
  const effectiveTab = isMerchant ? activeTab : 'ALERTS';

  const pendingCredits = customerCredits.flatMap((c) =>
    c.records
      .filter((r) => r.approvalStatus === 'PENDING')
      .map((r) => ({ ...r, customerName: c.customerName }))
  );

  const pendingDiscrepancies = stockDiscrepancyAlerts.filter((a) => a.status === 'PENDING');

  const pendingReconciliation = reconciliations.find(
    (r) => r.masterApprovalStatus === 'PENDING_MASTER_APPROVAL'
  );

  const remainingTotalNets = currentBatch
    ? currentBatch.remainingGrade1Nets + currentBatch.remainingGrade2Nets
    : 0;

  const lowStockAlert = currentBatch && remainingTotalNets <= 60;

  const recentRepayments = creditRepayments.slice(0, 2);

  const totalAlertCount =
    pendingDiscrepancies.length +
    pendingCredits.length +
    (pendingReconciliation ? 1 : 0) +
    (lowStockAlert ? 1 : 0);

  const handleResolveDiscrepancy = (alertId: string) => {
    Alert.alert(
      'Resolve Stock Discrepancy?',
      'Confirm that you have reviewed the physical count variance and adjusted or accepted the allocation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✓ Confirm Resolution',
          onPress: () => {
            resolveStockDiscrepancy(alertId);
            Alert.alert('✅ Discrepancy Resolved', 'The stock allocation status has been updated and logged in the audit trail.');
          },
        },
      ]
    );
  };

  const getActivityIcon = (type: StaffActivityLog['actionType']) => {
    switch (type) {
      case 'APP_LOGIN':
        return { name: 'phone-portrait', color: '#0284C7', bg: '#E0F2FE' };
      case 'STOCK_ACKNOWLEDGED':
        return { name: 'checkmark-circle', color: '#059669', bg: '#D1FAE5' };
      case 'STOCK_DISCREPANCY_RAISED':
        return { name: 'warning', color: '#DC2626', bg: '#FEE2E2' };
      case 'SALE_RECORDED':
        return { name: 'cash', color: '#0891B2', bg: '#CFFAFE' };
      case 'CREDIT_ISSUED':
        return { name: 'card', color: '#D97706', bg: '#FEF3C7' };
      case 'CREDIT_REPAID':
        return { name: 'wallet', color: '#059669', bg: '#D1FAE5' };
      case 'COB_RECONCILIATION_SUBMITTED':
        return { name: 'scale', color: '#7C3AED', bg: '#EDE9FE' };
      case 'POLICY_ACCEPTED':
        return { name: 'document-text', color: '#0D9488', bg: '#CCFBF1' };
      default:
        return { name: 'information-circle', color: '#64748B', bg: '#F1F5F9' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <Text style={[styles.title, isDarkMode && styles.textWhite]}>
              Notification & Audit
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Segmented Tabs: Alerts vs Live Activity Audit Log (Audit Log is Master-only) */}
          <View style={[styles.tabBar, isDarkMode && styles.tabBarDark]}>
            <TouchableOpacity
              style={[styles.tabBtn, effectiveTab === 'ALERTS' && styles.tabBtnActive]}
              onPress={() => setActiveTab('ALERTS')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="alert-circle"
                size={14}
                color={effectiveTab === 'ALERTS' ? '#FFFFFF' : (isDarkMode ? '#38BDF8' : '#0891B2')}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  isDarkMode && { color: '#38BDF8' },
                  effectiveTab === 'ALERTS' && styles.tabBtnTextActive,
                ]}
              >
                Live Alerts ({totalAlertCount})
              </Text>
            </TouchableOpacity>

            {isMerchant && (
              <TouchableOpacity
                style={[styles.tabBtn, effectiveTab === 'AUDIT_LOG' && styles.tabBtnActive]}
                onPress={() => setActiveTab('AUDIT_LOG')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={14}
                  color={effectiveTab === 'AUDIT_LOG' ? '#FFFFFF' : (isDarkMode ? '#38BDF8' : '#0891B2')}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    isDarkMode && { color: '#38BDF8' },
                    effectiveTab === 'AUDIT_LOG' && styles.tabBtnTextActive,
                  ]}
                >
                  Staff Audit Log ({activityLogs.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab 1: Live Alerts */}
          {effectiveTab === 'ALERTS' ? (
            <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
              {/* 1. Pending Stock Discrepancies (Urgent alert for Master) */}
              {pendingDiscrepancies.map((disc) => (
                <View key={disc.id} style={[styles.notifCard, styles.notifCardRed, isDarkMode && styles.notifCardRedDark]}>
                  <View style={[styles.notifIconCircleRed, isDarkMode && { backgroundColor: 'rgba(220, 38, 38, 0.22)' }]}>
                    <Ionicons name="warning" size={18} color={isDarkMode ? '#F87171' : '#DC2626'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleRed, isDarkMode && { color: '#FCA5A5' }]}>⚠️ Stock Discrepancy Raised</Text>
                      <Text style={styles.timeTag}>URGENT</Text>
                    </View>
                    <Text style={[styles.notifBodyBold, isDarkMode && { color: '#E2E8F0' }]}>
                      Raised by: <Text style={{ color: isDarkMode ? '#FFFFFF' : '#0F172A' }}>{disc.sellerName}</Text>
                    </Text>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      Physical count: G1={disc.physicalG1} (vs {disc.expectedG1} assigned) • G2={disc.physicalG2} (vs {disc.expectedG2} assigned).
                    </Text>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }, { fontStyle: 'italic', marginTop: 2 }]}>
                      Note: "{disc.note}"
                    </Text>
                    {role === 'MERCHANT' && (
                      <TouchableOpacity
                        style={styles.actionBtnRed}
                        onPress={() => handleResolveDiscrepancy(disc.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={13} color="#FFFFFF" />
                        <Text style={styles.actionBtnTextRed}>Resolve & Accept Count</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {/* 2. Pending Credit Sign-Off Alert */}
              {pendingCredits.length > 0 && (
                <View style={[styles.notifCard, styles.notifCardAmber, isDarkMode && styles.notifCardAmberDark]}>
                  <View style={[styles.notifIconCircleAmber, isDarkMode && { backgroundColor: 'rgba(217, 119, 6, 0.22)' }]}>
                    <Ionicons name="alert-circle" size={18} color={isDarkMode ? '#FBBF24' : '#D97706'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleAmber, isDarkMode && { color: '#FCD34D' }]}>Pending Credit Sign-Off</Text>
                      <Text style={styles.timeTag}>{pendingCredits.length} Pending</Text>
                    </View>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      {pendingCredits.length === 1
                        ? `Credit sale to ${pendingCredits[0].customerName} (Ksh ${pendingCredits[0].totalOwed.toLocaleString()}) requires approval.`
                        : `${pendingCredits.length} credit transactions awaiting your authorization.`}
                    </Text>
                    {onNavigateToCredits && (
                      <TouchableOpacity
                        style={styles.actionBtnAmber}
                        onPress={() => {
                          onClose();
                          onNavigateToCredits();
                        }}
                      >
                        <Text style={[styles.actionBtnTextAmber, isDarkMode && { color: '#FBBF24' }]}>Review & Sign Off ➔</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* 3. 14:00 COB Day Closure Alert */}
              {pendingReconciliation && (
                <View style={[styles.notifCard, styles.notifCardCyan, isDarkMode && styles.notifCardCyanDark]}>
                  <View style={[styles.notifIconCircleCyan, isDarkMode && { backgroundColor: 'rgba(8, 145, 178, 0.25)' }]}>
                    <Ionicons name="scale" size={18} color={isDarkMode ? '#22D3EE' : '#0891B2'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleCyan, isDarkMode && { color: '#67E8F9' }]}>14:00 COB Day Closure Ready</Text>
                      <Text style={styles.timeTag}>Approval</Text>
                    </View>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      Closure receipt generated by {pendingReconciliation.reconciledBy}. Balance: Ksh{' '}
                      {pendingReconciliation.expectedCashInHand.toLocaleString()} (Cash) + Ksh{' '}
                      {pendingReconciliation.expectedMpesaWallet.toLocaleString()} (M-Pesa).
                    </Text>
                    {onNavigateToCredits && (
                      <TouchableOpacity
                        style={styles.actionBtnCyan}
                        onPress={() => {
                          onClose();
                          onNavigateToCredits();
                        }}
                      >
                        <Text style={[styles.actionBtnTextCyan, isDarkMode && { color: '#22D3EE' }]}>View Daily Closure ➔</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* 4. Truck Stay Day & Demurrage Notice */}
              {currentBatch && (
                <View style={[styles.notifCard, styles.notifCardSlate, isDarkMode && styles.notifCardSlateDark]}>
                  <View style={[styles.notifIconCircleSlate, isDarkMode && { backgroundColor: 'rgba(2, 132, 199, 0.22)' }]}>
                    <Ionicons name="calendar-outline" size={18} color={isDarkMode ? '#38BDF8' : '#0284C7'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleSlate, isDarkMode && styles.textWhite]}>
                        Truck Stay: Day {currentBatch.dayNumber} of 4
                      </Text>
                      <Text style={styles.timeTag}>{currentBatch.truckPlate}</Text>
                    </View>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      {currentBatch.dayNumber === 1
                        ? 'Day 1 Base County Cess active. No daily demurrage fees incurred today.'
                        : `Currently on Day ${currentBatch.dayNumber}. Flat Ksh 1,000/day county demurrage applies.`}
                    </Text>
                  </View>
                </View>
              )}

              {/* 5. Stock Depletion Alert */}
              {lowStockAlert && (
                <View style={[styles.notifCard, styles.notifCardRose, isDarkMode && styles.notifCardRoseDark]}>
                  <View style={[styles.notifIconCircleRose, isDarkMode && { backgroundColor: 'rgba(225, 29, 72, 0.22)' }]}>
                    <Ionicons name="cube-outline" size={18} color={isDarkMode ? '#FB7185' : '#DC2626'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleRose, isDarkMode && { color: '#FDA4AF' }]}>Consignment Stock Alert</Text>
                      <Text style={styles.timeTag}>Stock Low</Text>
                    </View>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      Only {remainingTotalNets} nets remaining on truck{' '}
                      {currentBatch?.truckPlate}. High sell-through rate.
                    </Text>
                  </View>
                </View>
              )}

              {/* 6. Recent Debtor Repayment Confirmation */}
              {recentRepayments.map((rep) => (
                <View key={rep.id} style={[styles.notifCard, styles.notifCardEmerald, isDarkMode && styles.notifCardEmeraldDark]}>
                  <View style={[styles.notifIconCircleEmerald, isDarkMode && { backgroundColor: 'rgba(5, 150, 105, 0.24)' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={isDarkMode ? '#34D399' : '#059669'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitleEmerald, isDarkMode && { color: '#6EE7B7' }]}>Credit Repayment Collected</Text>
                      <Text style={styles.timeTag}>M-Pesa</Text>
                    </View>
                    <Text style={[styles.notifBody, isDarkMode && { color: '#CBD5E1' }]}>
                      Ksh {rep.amountPaid.toLocaleString()} paid via {rep.paymentMethod} (Ref:{' '}
                      {rep.mpesaReceiptCode || 'Cash'}).
                    </Text>
                  </View>
                </View>
              ))}

              {/* System Info */}
              <View style={[styles.systemInfoBox, isDarkMode && styles.systemInfoBoxDark]}>
                <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                <Text style={styles.systemInfoText}>
                  Active Profile: {role === 'MERCHANT' ? 'Master Admin' : 'Sales Staff'} •
                  Wakulima Market Terminal
                </Text>
              </View>
            </ScrollView>
          ) : (
            /* Tab 2: Staff Live Activity Audit Log */
            <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
              {activityLogs.length > 0 ? (
                <View style={styles.auditTimeline}>
                  {activityLogs.map((log, index) => {
                    const iconConfig = getActivityIcon(log.actionType);
                    const timeFormatted = new Date(log.timestamp).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <View key={log.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View
                            style={[
                              styles.timelineIconBadge,
                              {
                                backgroundColor: isDarkMode ? '#256A71' : iconConfig.bg,
                                borderWidth: isDarkMode ? 1 : 0,
                                borderColor: isDarkMode ? '#7AB5BC' : 'transparent',
                              },
                            ]}
                          >
                            <Ionicons name={iconConfig.name as any} size={14} color={iconConfig.color} />
                          </View>
                          {index < activityLogs.length - 1 && (
                            <View style={[styles.timelineLine, isDarkMode && { backgroundColor: '#7AB5BC' }]} />
                          )}
                        </View>

                        <View style={[styles.timelineCard, isDarkMode && styles.timelineCardDark]}>
                          <View style={styles.timelineHeaderRow}>
                            <Text style={[styles.timelineTitle, isDarkMode && styles.textWhite]}>
                              {log.title}
                            </Text>
                            <Text style={styles.timelineTime}>{timeFormatted}</Text>
                          </View>

                          <View style={styles.timelineStaffRow}>
                            <View style={[styles.staffTag, isDarkMode && styles.staffTagDark]}>
                              <Ionicons name="person" size={10} color={isDarkMode ? '#67E8F9' : '#0891B2'} />
                              <Text style={[styles.staffTagText, isDarkMode && { color: '#67E8F9' }]}>{log.staffName}</Text>
                            </View>
                            <Text style={[styles.roleSubtext, isDarkMode && { color: '#CFE9EC' }]}>({log.staffRole})</Text>
                          </View>

                          <Text style={[styles.timelineDesc, isDarkMode && { color: '#CFE9EC' }]}>
                            {log.description}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyLogBox}>
                  <Text style={styles.emptyLogText}>No staff activity logged today yet.</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Dismiss Button */}
          <TouchableOpacity
            style={[styles.dismissBtn, isDarkMode && styles.dismissBtnDark]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.dismissBtnText}>Close Modal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 18,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalCardDark: {
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerDark: {
    borderBottomColor: '#2E7B83',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFEFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleDark: {
    backgroundColor: 'rgba(8, 145, 178, 0.2)',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 10.5,
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  tabBarDark: {
    backgroundColor: '#256A71',
    borderWidth: 1,
    borderColor: '#7AB5BC',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabBtnActive: {
    backgroundColor: '#0891B2',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  scrollList: {
    marginTop: 4,
  },

  // Alert Cards
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  notifCardRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notifCardRedDark: {
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  notifIconCircleRed: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleRed: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  actionBtnRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionBtnTextRed: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  notifCardAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  notifCardAmberDark: {
    backgroundColor: 'rgba(217, 119, 6, 0.14)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  notifIconCircleAmber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleAmber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  actionBtnAmber: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionBtnTextAmber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },

  notifCardCyan: {
    backgroundColor: '#ECFEFF',
    borderColor: '#A5F3FC',
  },
  notifCardCyanDark: {
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderColor: 'rgba(34, 211, 238, 0.35)',
  },
  notifIconCircleCyan: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CFFAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleCyan: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E7490',
  },
  actionBtnCyan: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  actionBtnTextCyan: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },

  notifCardSlate: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  notifCardSlateDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  notifIconCircleSlate: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleSlate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },

  notifCardRose: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  notifCardRoseDark: {
    backgroundColor: 'rgba(225, 29, 72, 0.14)',
    borderColor: 'rgba(251, 113, 133, 0.35)',
  },
  notifIconCircleRose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleRose: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },

  notifCardEmerald: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  notifCardEmeraldDark: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  notifIconCircleEmerald: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitleEmerald: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },

  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  notifBodyBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  notifBody: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 15,
  },

  systemInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    marginTop: 4,
  },
  systemInfoBoxDark: {
    backgroundColor: '#256A71',
    borderWidth: 1,
    borderColor: '#7AB5BC',
  },
  systemInfoText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // Audit Log Styles
  auditIntroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#ECFEFF',
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  auditIntroBoxDark: {
    backgroundColor: 'rgba(8, 145, 178, 0.15)',
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  auditIntroText: {
    flex: 1,
    fontSize: 10,
    color: '#0891B2',
    lineHeight: 14,
    fontWeight: '600',
  },
  auditTimeline: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
    marginRight: 8,
  },
  timelineIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineTime: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  timelineStaffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    marginBottom: 4,
  },
  staffTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  staffTagDark: {
    backgroundColor: 'rgba(8, 145, 178, 0.2)',
  },
  staffTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0891B2',
  },
  roleSubtext: {
    fontSize: 9,
    color: '#64748B',
  },
  timelineDesc: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 14,
  },
  emptyLogBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyLogText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  dismissBtn: {
    backgroundColor: '#0891B2',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  dismissBtnDark: {
    backgroundColor: '#0E7490',
    borderWidth: 1,
    borderColor: '#7AB5BC',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  textWhite: {
    color: '#FFFFFF',
  },
});

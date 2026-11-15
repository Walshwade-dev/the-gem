// ============================================================================
// The Gem: Customer Credit Ledger (Madeni) & Debt Collection Modal
// Kenya DPA 2019 Compliant, Reconciles Collections Without Duplicating Sack Counts
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { maskPhoneNumber } from '../services/security';

interface CreditLedgerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreditLedgerModal: React.FC<CreditLedgerModalProps> = ({ visible, onClose }) => {
  const { 
    customerCredits, 
    recordCreditRepayment, 
    approveCreditSale, 
    rejectCreditSale, 
    role, 
    currentUserName,
    masterName,
    isDarkMode 
  } = useAppStore();

  const effectiveMaster = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const [payingEntryId, setPayingEntryId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [repayMethod, setRepayMethod] = useState<'CASH' | 'MPESA'>('MPESA');
  const [mpesaRef, setMpesaRef] = useState<string>('');

  const totalOutstandingAll = customerCredits.reduce(
    (sum, c) => sum + c.totalOutstandingCredit, 
    0
  );

  const handleStartRepayment = (customerId: string, entryId: string, balance: number) => {
    setPayingCustomerId(customerId);
    setPayingEntryId(entryId);
    setRepayAmount(balance.toString());
  };

  const handleConfirmRepayment = () => {
    const amount = parseFloat(repayAmount) || 0;
    if (amount <= 0 || !payingCustomerId || !payingEntryId) {
      Alert.alert('Invalid Amount', 'Please enter a valid repayment amount.');
      return;
    }

    recordCreditRepayment({
      customerId: payingCustomerId,
      creditEntryId: payingEntryId,
      amount,
      paymentMethod: repayMethod,
      mpesaReceiptCode: mpesaRef.trim() || undefined
    });

    Alert.alert(
      'Payment Recorded (Deni Limelipwa)',
      `Ksh ${amount.toLocaleString()} received via ${repayMethod}.\nAdded to today's drawer reconciliation without affecting today's sack inventory!`
    );

    setPayingCustomerId(null);
    setPayingEntryId(null);
    setRepayAmount('');
    setMpesaRef('');
  };

  const handleApproveEntry = (entryId: string, debtorName: string, amount: number) => {
    approveCreditSale(entryId);
    Alert.alert(
      '✅ Credit Sale Approved',
      `Credit for ${debtorName} totaling Ksh ${amount.toLocaleString()} has been formally approved.`
    );
  };

  const handleRejectEntry = (entryId: string, debtorName: string, amount: number) => {
    Alert.alert(
      'Reject Credit Sale?',
      `Are you sure you want to reject credit for ${debtorName} (Ksh ${amount.toLocaleString()})? The allocated nets will be restored to bay inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject Sale', 
          style: 'destructive', 
          onPress: () => {
            rejectCreditSale(entryId);
            Alert.alert('Credit Sale Rejected', `Credit request cancelled and stock restored to inventory.`);
          } 
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Mobile Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, isDarkMode && { backgroundColor: '#475569' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <View>
              <View style={styles.titleRow}>
                <Ionicons name="receipt" size={20} color={isDarkMode ? '#22D3EE' : '#0891B2'} />
                <Text style={[styles.title, isDarkMode && { color: '#22D3EE' }]}>
                  CREDIT LEDGER (KITABU CHA MADENI)
                </Text>
              </View>
              <Text style={styles.subtitle}>
                Total Outstanding: Ksh {totalOutstandingAll.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDarkMode ? '#E2E8F0' : THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Kenya DPA 2019 Banner */}
          <View style={[styles.dpaBanner, isDarkMode && styles.dpaBannerDark]}>
            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            <Text style={[styles.dpaText, isDarkMode && { color: '#A7F3D0' }]}>
              Protected under Kenya Data Protection Act (DPA 2019). Explicit debtor SMS consent or authorized guarantor liability recorded.
            </Text>
          </View>

          {/* Repayment Action Form (if active) */}
          {payingCustomerId && payingEntryId && (
            <View style={[styles.repayForm, isDarkMode && styles.repayFormDark]}>
              <Text style={[styles.repayFormTitle, isDarkMode && { color: '#F8FAFC' }]}>
                COLLECT DEBT PAYMENT (LIPA DENI)
              </Text>
              
              <View style={styles.repayInputsRow}>
                <TextInput
                  style={[styles.repayInput, isDarkMode && styles.inputDark]}
                  placeholder="Amount Ksh"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="numeric"
                  value={repayAmount}
                  onChangeText={setRepayAmount}
                />
                
                <View style={styles.methodToggle}>
                  <TouchableOpacity 
                    style={[styles.methodBtn, repayMethod === 'CASH' && styles.methodBtnActive]}
                    onPress={() => setRepayMethod('CASH')}
                  >
                    <Text style={[styles.methodBtnText, repayMethod === 'CASH' && styles.textWhite]}>Cash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.methodBtn, repayMethod === 'MPESA' && styles.methodBtnActive]}
                    onPress={() => setRepayMethod('MPESA')}
                  >
                    <Text style={[styles.methodBtnText, repayMethod === 'MPESA' && styles.textWhite]}>M-Pesa</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {repayMethod === 'MPESA' && (
                <TextInput
                  style={[styles.repayInput, { marginTop: 6 }, isDarkMode && styles.inputDark]}
                  placeholder="M-Pesa Confirmation Code (e.g. QJK9923KPP)"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={mpesaRef}
                  onChangeText={setMpesaRef}
                />
              )}

              <View style={styles.repayActions}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => { setPayingCustomerId(null); setPayingEntryId(null); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmRepayBtn} 
                  onPress={handleConfirmRepayment}
                >
                  <Text style={styles.confirmRepayBtnText}>Confirm Repayment</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* List of Debtors */}
          <FlatList
            data={customerCredits}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.customerCard, isDarkMode && styles.customerCardDark]}>
                <View style={[styles.custHeader, isDarkMode && styles.custHeaderDark]}>
                  <View>
                    <Text style={[styles.custName, isDarkMode && { color: '#F8FAFC' }]}>
                      {item.customerName}
                    </Text>
                    <Text style={[styles.custPhone, isDarkMode && { color: '#94A3B8' }]}>
                      {maskPhoneNumber(item.customerPhone)}
                    </Text>
                  </View>
                  <View style={styles.balanceBadge}>
                    <Text style={styles.balanceBadgeText}>
                      Owed: Ksh {item.totalOutstandingCredit.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Outstanding Entries with Full Stock Lineage */}
                {item.records.map((entry) => {
                  const remainingOwed = entry.totalOwed - entry.amountPaid;
                  return (
                    <View key={entry.id} style={[styles.entryRow, isDarkMode && styles.entryRowDark]}>
                      <View style={{ flex: 1 }}>
                        {/* Lineage Badge Row */}
                        <View style={styles.lineageBadgeRow}>
                          <View style={styles.truckBadge}>
                            <Ionicons name="car-outline" size={11} color="#0F172A" />
                            <Text style={styles.truckBadgeText}>{entry.truckPlate || 'KDE 421B'}</Text>
                          </View>
                          <View style={styles.originPill}>
                            <Ionicons name="location-outline" size={11} color="#881337" />
                            <Text style={styles.originPillText} numberOfLines={1}>
                              {entry.originSpecificLocation || entry.originRegion || 'Northern Tanzania'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.entryDetails, isDarkMode && { color: '#F8FAFC' }]}>
                          {entry.quantityNets} nets of {entry.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'}
                        </Text>
                        <Text style={[styles.entryAuthInfo, isDarkMode && { color: '#94A3B8' }]}>
                          Issued: {entry.dateIssued} • Authorized by: <Text style={styles.boldText}>{entry.authorizedBy && entry.authorizedBy !== 'Nelson' && entry.authorizedBy !== 'Merchant Admin' ? entry.authorizedBy : effectiveMaster}</Text>
                        </Text>

                        {/* Debtor Kenyan National ID */}
                        {(entry.buyerNationalId || item.customerNationalId) && (
                          <View style={styles.idBadge}>
                            <Ionicons name="card-outline" size={10} color="#0E7490" />
                            <Text style={styles.idBadgeText}>
                              Debtor National ID: <Text style={styles.boldText}>{entry.buyerNationalId || item.customerNationalId}</Text>
                            </Text>
                          </View>
                        )}
                        
                        {/* Verification & Liability Badge */}
                        {entry.buyerConsentConfirmed && (
                          <View style={styles.consentBadgeVerified}>
                            <Ionicons name="chatbubble-ellipses" size={10} color="#059669" />
                            <Text style={styles.consentBadgeVerifiedText}>
                              Debtor SMS Agreement Confirmed
                            </Text>
                          </View>
                        )}
                        {entry.guarantorName && (
                          <View style={styles.guarantorLiabilityBadge}>
                            <Ionicons name="shield-checkmark" size={10} color="#0891B2" />
                            <Text style={styles.guarantorLiabilityBadgeText}>
                              Guarantor: {entry.guarantorName} (ID: {entry.guarantorNationalId || 'Verified'}) • {entry.guarantorRole || 'Liable'}
                            </Text>
                          </View>
                        )}

                        {/* Approval Status Badge */}
                        <View style={styles.approvalStatusRow}>
                          {entry.approvalStatus === 'PENDING' && (
                            <View style={styles.pendingApprovalBadge}>
                              <Ionicons name="time" size={10} color="#D97706" />
                              <Text style={styles.pendingApprovalBadgeText}>Pending Master Approval</Text>
                            </View>
                          )}
                          {entry.approvalStatus === 'APPROVED' && (
                            <View style={styles.approvedBadge}>
                              <Ionicons name="checkmark-done" size={10} color="#059669" />
                              <Text style={styles.approvedBadgeText}>Master Approved</Text>
                            </View>
                          )}
                          {entry.approvalStatus === 'REJECTED' && (
                            <View style={styles.rejectedBadge}>
                              <Ionicons name="close-circle" size={10} color="#DC2626" />
                              <Text style={styles.rejectedBadgeText}>Master Rejected</Text>
                            </View>
                          )}
                        </View>

                        {/* Merchant Action Row for Pending Items */}
                        {role === 'MERCHANT' && entry.approvalStatus === 'PENDING' && (
                          <View style={styles.merchantActionRow}>
                            <TouchableOpacity 
                              style={styles.merchantApproveBtn}
                              onPress={() => handleApproveEntry(entry.id, item.customerName, entry.totalOwed)}
                            >
                              <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                              <Text style={styles.merchantApproveBtnText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.merchantRejectBtn}
                              onPress={() => handleRejectEntry(entry.id, item.customerName, entry.totalOwed)}
                            >
                              <Ionicons name="close-circle" size={12} color="#DC2626" />
                              <Text style={styles.merchantRejectBtnText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        <Text style={[styles.entryPaidInfo, isDarkMode && { color: '#CBD5E1' }]}>
                          Paid: Ksh {entry.amountPaid.toLocaleString()} / {entry.totalOwed.toLocaleString()}
                        </Text>
                      </View>

                      {remainingOwed > 0 ? (
                        <TouchableOpacity 
                          style={styles.collectBtn}
                          onPress={() => handleStartRepayment(item.id, entry.id, remainingOwed)}
                        >
                          <Text style={styles.collectBtnText}>Collect</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.settledBadge}>
                          <Text style={styles.settledText}>SETTLED</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 500,
    height: '88%',
    paddingBottom: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  dpaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
  },
  dpaText: {
    fontSize: 10,
    color: '#166534',
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  custHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  custName: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  custPhone: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  balanceBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  balanceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  entryDetails: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  entryPaidInfo: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  collectBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  collectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  settledBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  settledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  repayForm: {
    backgroundColor: '#EFF6FF',
    margin: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  repayFormTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 8,
  },
  repayInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  repayInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  methodToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 6,
    overflow: 'hidden',
  },
  methodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  methodBtnActive: {
    backgroundColor: '#2563EB',
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  repayActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  confirmRepayBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  confirmRepayBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  lineageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  truckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  truckBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  originPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 180,
  },
  originPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#881337',
  },
  entryAuthInfo: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  modalCardDark: {
    backgroundColor: '#1E293B',
  },
  headerDark: {
    borderBottomColor: '#334155',
  },
  dpaBannerDark: {
    backgroundColor: '#064E3B',
    borderBottomColor: '#059669',
  },
  repayFormDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  inputDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  customerCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  custHeaderDark: {
    borderBottomColor: '#334155',
  },
  entryRowDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  consentBadgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  consentBadgeVerifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
  },
  guarantorLiabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  guarantorLiabilityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  idBadgeText: {
    fontSize: 9,
    color: '#0E7490',
  },
  approvalStatusRow: {
    marginTop: 4,
    flexDirection: 'row',
  },
  pendingApprovalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingApprovalBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  approvedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rejectedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B91C1C',
  },
  merchantActionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  merchantApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  merchantApproveBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  merchantRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  merchantRejectBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  }
});

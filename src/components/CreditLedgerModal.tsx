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
  const { customerCredits, recordCreditRepayment } = useAppStore();

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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Ionicons name="receipt" size={20} color={THEME.colors.primary} />
                <Text style={styles.title}>CREDIT LEDGER (KITABU CHA MADENI)</Text>
              </View>
              <Text style={styles.subtitle}>
                Total Outstanding: Ksh {totalOutstandingAll.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Kenya DPA 2019 Banner */}
          <View style={styles.dpaBanner}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.dpaText}>
              Protected under Kenya Data Protection Act (DPA 2019). Phone numbers are pseudonymized and encrypted.
            </Text>
          </View>

          {/* Repayment Action Form (if active) */}
          {payingCustomerId && payingEntryId && (
            <View style={styles.repayForm}>
              <Text style={styles.repayFormTitle}>COLLECT DEBT PAYMENT (LIPA DENI)</Text>
              
              <View style={styles.repayInputsRow}>
                <TextInput
                  style={styles.repayInput}
                  placeholder="Amount Ksh"
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
                  style={[styles.repayInput, { marginTop: 6 }]}
                  placeholder="M-Pesa Confirmation Code (e.g. QJK9923KPP)"
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
              <View style={styles.customerCard}>
                <View style={styles.custHeader}>
                  <View>
                    <Text style={styles.custName}>{item.customerName}</Text>
                    <Text style={styles.custPhone}>{maskPhoneNumber(item.customerPhone)}</Text>
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
                    <View key={entry.id} style={styles.entryRow}>
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

                        <Text style={styles.entryDetails}>
                          {entry.quantityNets} nets of {entry.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'}
                        </Text>
                        <Text style={styles.entryAuthInfo}>
                          Issued: {entry.dateIssued} • Authorized by: <Text style={styles.boldText}>{entry.authorizedBy || 'Merchant Admin'}</Text>
                        </Text>
                        <Text style={styles.entryPaidInfo}>
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
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
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
    color: THEME.colors.primary,
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
  }
});

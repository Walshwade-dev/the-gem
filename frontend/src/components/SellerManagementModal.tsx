// ============================================================================
// The Gem: Hired Seller Delegation & Stock Quota Allocation Modal
// Sets Opening Quota, Expected Prices & Monitors Real-Time Seller Performance
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { confirmAndRevokeAssignment } from '../utils/revokeAssignmentPrompt';

interface SellerManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToProducts?: () => void;
}

export const SellerManagementModal: React.FC<SellerManagementModalProps> = ({ 
  visible, 
  onClose,
  onNavigateToProducts 
}) => {
  const {
    currentBatch,
    allocations,
    allocateStockToSeller,
    revokeSellerAssignment,
    generateSellerInviteCode,
    isDarkMode,
  } = useAppStore();

  const unassignedG1 = currentBatch?.unassignedGrade1Nets ?? currentBatch?.remainingGrade1Nets ?? 0;
  const unassignedG2 = currentBatch?.unassignedGrade2Nets ?? currentBatch?.remainingGrade2Nets ?? 0;

  const [sellerName, setSellerName] = useState<string>('Juma (Sales Assistant)');
  const [sellerPhone, setSellerPhone] = useState<string>('0799887766');
  const [g1Allocated, setG1Allocated] = useState<string>('40');
  const [g2Allocated, setG2Allocated] = useState<string>('20');
  const [g1TargetPrice, setG1TargetPrice] = useState<string>('1300');
  const [g2TargetPrice, setG2TargetPrice] = useState<string>('1200');
  const [issuedCodes, setIssuedCodes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Prepopulate prices and sensible quotas from active batch
  useEffect(() => {
    if (currentBatch) {
      if (currentBatch.pricePerBagGrade1) setG1TargetPrice(currentBatch.pricePerBagGrade1.toString());
      if (currentBatch.pricePerBagGrade2) setG2TargetPrice(currentBatch.pricePerBagGrade2.toString());

      const maxG1 = unassignedG1;
      const maxG2 = unassignedG2;
      setG1Allocated(maxG1 > 0 ? Math.min(40, maxG1).toString() : '0');
      setG2Allocated(maxG2 > 0 ? Math.min(20, maxG2).toString() : '0');
    }
  }, [currentBatch]);

  // When master tries to assign stock but no stock has been added yet:
  const hasAvailableStock = currentBatch && (
    unassignedG1 > 0 ||
    unassignedG2 > 0
  );

  if (!visible) return null;

  if (!hasAvailableStock) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, isDarkMode && styles.dragHandleDark]} />
            </View>

            {/* Header */}
            <View style={[styles.header, isDarkMode && styles.headerDark]}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#E11D48" />
                <View>
                  <Text style={[styles.title, { color: '#E11D48' }]}>NO STOCK ADDED YET</Text>
                  <Text style={[styles.subtitle, isDarkMode && styles.textMuted]}>
                    Stock Required Before Assigning Sales Staff
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.noStockContainer}>
              <View style={styles.noStockIconCircle}>
                <MaterialCommunityIcons name="package-variant-closed-remove" size={54} color="#E11D48" />
              </View>
              
              <Text style={[styles.noStockTitle, isDarkMode && styles.textWhite]}>
                Add Stock in Products First
              </Text>
              
              <Text style={[styles.noStockMessage, isDarkMode && styles.textMuted]}>
                You cannot assign stock to sales staff because no stock exists in the store. Please go to the Products tab, add a product with stock, and then return here to allocate quota.
              </Text>

              <TouchableOpacity 
                style={[styles.assignBtn, { backgroundColor: '#0891B2', width: '100%' }]}
                onPress={() => {
                  onClose();
                  if (onNavigateToProducts) {
                    onNavigateToProducts();
                  }
                }}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.assignBtnText}>GO TO PRODUCTS & ADD STOCK</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.cancelBtn, isDarkMode && styles.cancelBtnDark]} 
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, isDarkMode && styles.textMuted]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const handleIssueLoginCode = async (phone: string, name: string) => {
    const res = await generateSellerInviteCode(phone);
    if (res.success && res.code) {
      setIssuedCodes((prev) => ({ ...prev, [phone]: res.code! }));
      Alert.alert(
        '🔑 Worker Login Code',
        `Share this 6-digit login code with ${name} (${phone}):\n\n${res.code}\n\nValid for 24 hours. They can enter it on the Sales Login tab and set their own passphrase.`
      );
    } else {
      Alert.alert('Could Not Generate Code', res.message || 'Please try again.');
    }
  };

  const handleAllocate = async () => {
    if (isSubmitting) return;
    if (!currentBatch || (unassignedG1 <= 0 && unassignedG2 <= 0)) {
      Alert.alert(
        '⚠️ No Unassigned Stock',
        'All remaining stock in this batch is already assigned or sold. Revoke an assignment first to reassign.'
      );
      return;
    }

    const cleanSellerName = sellerName.trim();
    if (!cleanSellerName) {
      Alert.alert('Seller Name Required', 'Please enter sales agent name (text string).');
      return;
    }

    const cleanSellerPhone = sellerPhone.trim();
    if (!cleanSellerPhone) {
      Alert.alert('Seller Phone Required', 'Please enter seller mobile phone number so they can receive their login OTP.');
      return;
    }

    // Explicit Type Enforcements:
    // Nets: Positive integers
    const g1 = Math.max(0, Math.floor(parseInt(g1Allocated, 10)) || 0);
    const g2 = Math.max(0, Math.floor(parseInt(g2Allocated, 10)) || 0);
    // Prices: Positive numbers (floats)
    const p1 = Math.max(0, parseFloat(g1TargetPrice) || 0);
    const p2 = Math.max(0, parseFloat(g2TargetPrice) || 0);

    if (g1 === 0 && g2 === 0) {
      Alert.alert('Quota Required', 'Please assign at least 1 net of Grade 1 or Grade 2 stock.');
      return;
    }

    if (g1 > unassignedG1) {
      Alert.alert(
        'Quota Exceeds Remaining Stock',
        `Cannot allocate ${g1} Grade 1 nets. Only ${unassignedG1} unassigned nets remain in warehouse stock.`
      );
      return;
    }

    if (g2 > unassignedG2) {
      Alert.alert(
        'Quota Exceeds Remaining Stock',
        `Cannot allocate ${g2} Grade 2 nets. Only ${unassignedG2} unassigned nets remain in warehouse stock.`
      );
      return;
    }

    if (g1 > 0 && p1 <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid target selling price for Grade 1.');
      return;
    }

    if (g2 > 0 && p2 <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid target selling price for Grade 2.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await allocateStockToSeller({
        sellerId: `usr-seller-${Date.now()}`,
        sellerName: cleanSellerName,
        sellerPhone: cleanSellerPhone,
        grade1Allocated: g1,
        grade2Allocated: g2,
        expectedPriceG1: p1,
        expectedPriceG2: p2,
      });

      if (result?.inviteCode) {
        setIssuedCodes((prev) => ({ ...prev, [cleanSellerPhone]: result.inviteCode! }));
      }

      Alert.alert(
        '✅ Seller Assigned & Activated',
        result?.inviteCode
          ? `${cleanSellerName} assigned ${g1} G1 nets & ${g2} G2 nets.\nPhone: ${cleanSellerPhone}\n\n🔑 Worker Login Code: ${result.inviteCode}\nShare this 6-digit code with ${cleanSellerName} so they can log in and set their passphrase.`
          : `${cleanSellerName} assigned ${g1} G1 nets & ${g2} G2 nets.\nPhone registered: ${cleanSellerPhone}.`
      );
    } catch (err) {
      Alert.alert(
        'Assignment Failed',
        err instanceof Error ? err.message : 'Unable to assign stock to seller.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Mobile Bottom-Sheet Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, isDarkMode && styles.dragHandleDark]} />
          </View>

          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="account-tie" size={24} color="#0891B2" />
              <View>
                <Text style={styles.title}>HIRED SELLER DELEGATION</Text>
                <Text style={[styles.subtitle, isDarkMode && styles.textMuted]}>
                  Assign Stock Quotas & Target Prices for Sales Staff
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Form */}
            <View style={[styles.formBox, isDarkMode && styles.formBoxDark]}>
              <Text style={styles.formTitle}>NEW SELLER QUOTA ASSIGNMENT</Text>
              
              <Text style={[styles.label, isDarkMode && styles.labelDark]}>SELLER / AGENT NAME (STRING)</Text>
              <TextInput
                style={[styles.textInput, isDarkMode && styles.textInputDark]}
                placeholder="e.g. Juma or Brian"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={sellerName}
                onChangeText={setSellerName}
              />

              <Text style={[styles.label, isDarkMode && styles.labelDark]}>SELLER MOBILE PHONE (STRING/PHONE)</Text>
              <TextInput
                style={[styles.textInput, isDarkMode && styles.textInputDark]}
                placeholder="e.g. 0799887766"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                keyboardType="phone-pad"
                value={sellerPhone}
                onChangeText={setSellerPhone}
              />

              {/* Grade 1 Allocation & Target Price */}
              <View style={styles.row}>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                    GRADE 1 NETS (INTEGER, Max: {unassignedG1})
                  </Text>
                  <TextInput
                    style={[styles.textInput, isDarkMode && styles.textInputDark]}
                    keyboardType="number-pad"
                    value={g1Allocated}
                    onChangeText={setG1Allocated}
                  />
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                    EXPECTED G1 PRICE (FLOAT KSH)
                  </Text>
                  <TextInput
                    style={[styles.textInput, isDarkMode && styles.textInputDark]}
                    keyboardType="decimal-pad"
                    value={g1TargetPrice}
                    onChangeText={setG1TargetPrice}
                  />
                </View>
              </View>

              {/* Grade 2 Allocation & Target Price */}
              <View style={styles.row}>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                    GRADE 2 NETS (INTEGER, Max: {unassignedG2})
                  </Text>
                  <TextInput
                    style={[styles.textInput, isDarkMode && styles.textInputDark]}
                    keyboardType="number-pad"
                    value={g2Allocated}
                    onChangeText={setG2Allocated}
                  />
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                    EXPECTED G2 PRICE (FLOAT KSH)
                  </Text>
                  <TextInput
                    style={[styles.textInput, isDarkMode && styles.textInputDark]}
                    keyboardType="decimal-pad"
                    value={g2TargetPrice}
                    onChangeText={setG2TargetPrice}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.assignBtn} onPress={handleAllocate}>
                <Ionicons name="person-add" size={18} color="#FFFFFF" />
                <Text style={styles.assignBtnText}>ASSIGN STOCK & ACTIVATE SELLER</Text>
              </TouchableOpacity>
            </View>

            {/* Existing Allocations */}
            <Text style={[styles.listHeader, isDarkMode && styles.textWhite]}>ACTIVE SELLER ALLOCATIONS</Text>
            {allocations.map(alloc => {
              const codeForSeller = issuedCodes[alloc.sellerPhone];
              return (
              <View key={alloc.id} style={[styles.allocCard, isDarkMode && styles.allocCardDark]}>
                <View style={styles.allocHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.allocName, isDarkMode && styles.textWhite]}>{alloc.sellerName}</Text>
                    <Text style={styles.allocPhoneText}>Phone: {alloc.sellerPhone || 'N/A'}</Text>
                    {codeForSeller ? (
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981', marginTop: 2 }}>
                        Login Code: {codeForSeller} (Share with worker)
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => handleIssueLoginCode(alloc.sellerPhone, alloc.sellerName)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: isDarkMode ? '#143D42' : '#E0F2FE',
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(122, 181, 188, 0.45)' : '#BAE6FD',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="key-outline" size={13} color={isDarkMode ? '#5EEAD4' : '#0891B2'} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isDarkMode ? '#5EEAD4' : '#0891B2' }}>
                        {codeForSeller ? 'New Code' : 'Get Code'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmAndRevokeAssignment(alloc, revokeSellerAssignment)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: isDarkMode ? '#3B181C' : '#FEF2F2',
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#EF4444' : '#FECACA',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="return-down-back" size={13} color="#EF4444" />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.allocGrid}>
                  <View style={[styles.allocStat, isDarkMode && styles.allocStatDark]}>
                    <Text style={[styles.allocStatLabel, isDarkMode && styles.textMuted]}>Grade 1 Quota</Text>
                    <Text style={[styles.allocStatVal, isDarkMode && styles.textWhite]}>
                      {alloc.grade1Sold || 0} / {alloc.grade1Allocated} nets
                    </Text>
                    <Text style={styles.allocPrice}>Target: Ksh {alloc.expectedPriceG1}</Text>
                  </View>

                  <View style={[styles.allocStat, isDarkMode && styles.allocStatDark]}>
                    <Text style={[styles.allocStatLabel, isDarkMode && styles.textMuted]}>Grade 2 Quota</Text>
                    <Text style={[styles.allocStatVal, isDarkMode && styles.textWhite]}>
                      {alloc.grade2Sold || 0} / {alloc.grade2Allocated} nets
                    </Text>
                    <Text style={styles.allocPrice}>Target: Ksh {alloc.expectedPriceG2}</Text>
                  </View>
                </View>
              </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  modalCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
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
  dragHandleDark: {
    backgroundColor: '#334155',
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
  headerDark: {
    borderBottomColor: '#1E293B',
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
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 16,
  },
  formBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  formBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  labelDark: {
    color: '#94A3B8',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  textInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {},
  assignBtn: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelBtn: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnDark: {},
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  allocCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  allocCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allocName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  allocPhoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
    marginTop: 1,
  },
  allocDate: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  allocGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  allocStat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  allocStatDark: {
    backgroundColor: '#0F172A',
  },
  allocStatLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  allocStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  allocPrice: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  noStockContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noStockIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noStockTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  noStockMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  textWhite: {
    color: '#F8FAFC',
  },
  textMuted: {
    color: '#94A3B8',
  },
});

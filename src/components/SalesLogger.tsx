// ============================================================================
// The Gem: Real-Time Sales & Dynamic Bargaining Logger
// High-Contrast, Ergonomic Touch Targets for Fast-Paced Wakulima Market Trading
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { ProduceGrade, PaymentMethod } from '../types';
import { useAppStore } from '../store/useAppStore';
import { MARKET_CONFIG } from '../constants/config';

export const SalesLogger: React.FC = () => {
  const { currentBatch, recordSale, role } = useAppStore();

  const [selectedGrade, setSelectedGrade] = useState<ProduceGrade>('GRADE_1');
  const [quantity, setQuantity] = useState<number>(5);
  const [unitPrice, setUnitPrice] = useState<string>(
    MARKET_CONFIG.grades.GRADE_1.defaultBaselinePrice.toString()
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [mpesaCode, setMpesaCode] = useState<string>('');

  if (!currentBatch) return null;

  const numericPrice = parseFloat(unitPrice) || 0;
  const totalAmount = quantity * numericPrice;

  const handleGradeSelect = (grade: ProduceGrade) => {
    setSelectedGrade(grade);
    const baseline = grade === 'GRADE_1' 
      ? MARKET_CONFIG.grades.GRADE_1.defaultBaselinePrice 
      : MARKET_CONFIG.grades.GRADE_2.defaultBaselinePrice;
    setUnitPrice(baseline.toString());
  };

  const adjustQuantity = (delta: number) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  const adjustPrice = (delta: number) => {
    const current = parseFloat(unitPrice) || 0;
    const next = Math.max(500, current + delta);
    setUnitPrice(next.toString());
  };

  const handleSubmitSale = () => {
    if (quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please specify at least 1 net.');
      return;
    }
    if (numericPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid negotiated price per net.');
      return;
    }

    if (paymentMethod === 'CREDIT' && !buyerName.trim()) {
      Alert.alert('Customer Name Required', 'Credit sales require the buyer name to track outstanding debt.');
      return;
    }

    const res = recordSale({
      grade: selectedGrade,
      quantityNets: quantity,
      negotiatedUnitPrice: numericPrice,
      paymentMethod,
      buyerName: buyerName.trim() || undefined,
      buyerPhone: buyerPhone.trim() || undefined,
      mpesaReceiptCode: mpesaCode.trim() || undefined
    });

    if (res.success) {
      Alert.alert(
        '✅ Sale Recorded',
        `${res.message}\nTotal: Ksh ${totalAmount.toLocaleString()} (${paymentMethod})`,
        [{ text: 'OK' }]
      );
      // Reset fields for next buyer
      setQuantity(1);
      setBuyerName('');
      setBuyerPhone('');
      setMpesaCode('');
    } else {
      Alert.alert('Sale Error', res.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="cash-register" size={20} color={THEME.colors.primary} />
            <Text style={styles.headerTitle}>RECORD SALE (SAJILI MAUZO)</Text>
          </View>
          <Text style={styles.sellerRoleTag}>
            {role === 'MERCHANT' ? 'Merchant Direct' : 'Seller Mode'}
          </Text>
        </View>

        {/* 1. Grade Selector */}
        <Text style={styles.fieldLabel}>1. SELECT PRODUCE GRADE</Text>
        <View style={styles.gradeToggleGroup}>
          <TouchableOpacity 
            style={[
              styles.gradeButton, 
              selectedGrade === 'GRADE_1' && styles.gradeButtonActiveG1
            ]}
            onPress={() => handleGradeSelect('GRADE_1')}
            activeOpacity={0.8}
          >
            <Text style={[styles.gradeButtonTitle, selectedGrade === 'GRADE_1' && styles.textWhite]}>
              Grade 1 (Kubwa)
            </Text>
            <Text style={[styles.gradeButtonSub, selectedGrade === 'GRADE_1' && styles.textWhiteLight]}>
              Target: Ksh {MARKET_CONFIG.grades.GRADE_1.defaultBaselinePrice}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.gradeButton, 
              selectedGrade === 'GRADE_2' && styles.gradeButtonActiveG2
            ]}
            onPress={() => handleGradeSelect('GRADE_2')}
            activeOpacity={0.8}
          >
            <Text style={[styles.gradeButtonTitle, selectedGrade === 'GRADE_2' && styles.textWhite]}>
              Grade 2 (Ndogo)
            </Text>
            <Text style={[styles.gradeButtonSub, selectedGrade === 'GRADE_2' && styles.textWhiteLight]}>
              Target: Ksh {MARKET_CONFIG.grades.GRADE_2.defaultBaselinePrice}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Quantity (Nets / Sacks) */}
        <Text style={styles.fieldLabel}>2. NUMBER OF NETS / SACKS</Text>
        <View style={styles.quantityRow}>
          <TouchableOpacity 
            style={styles.qtyAdjustBtn} 
            onPress={() => adjustQuantity(-1)}
          >
            <Ionicons name="remove" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.qtyDisplayBox}>
            <Text style={styles.qtyDisplayText}>{quantity}</Text>
            <Text style={styles.qtyDisplayUnit}>NETS</Text>
          </View>

          <TouchableOpacity 
            style={styles.qtyAdjustBtn} 
            onPress={() => adjustQuantity(1)}
          >
            <Ionicons name="add" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          {/* Quick preset buttons */}
          <View style={styles.presetsRow}>
            {[5, 10, 20].map(val => (
              <TouchableOpacity 
                key={val} 
                style={styles.presetPill} 
                onPress={() => setQuantity(val)}
              >
                <Text style={styles.presetPillText}>+{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Dynamic Negotiated Price */}
        <View style={styles.priceSection}>
          <View style={styles.priceHeaderRow}>
            <Text style={styles.fieldLabel}>3. NEGOTIATED PRICE PER NET (KSH)</Text>
            <View style={styles.negotiationBadge}>
              <Ionicons name="swap-horizontal" size={12} color="#059669" />
              <Text style={styles.negotiationBadgeText}>Bargained Rate</Text>
            </View>
          </View>

          <View style={styles.priceInputRow}>
            <View style={styles.currencyPrefix}>
              <Text style={styles.currencyPrefixText}>KSH</Text>
            </View>
            <TextInput
              style={styles.priceInput}
              keyboardType="numeric"
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="e.g. 2500"
            />
            {/* Quick bargain adjust buttons */}
            <TouchableOpacity style={styles.bargainChip} onPress={() => adjustPrice(-50)}>
              <Text style={styles.bargainChipText}>-50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bargainChip} onPress={() => adjustPrice(+50)}>
              <Text style={styles.bargainChipText}>+50</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Calculation Banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>TOTAL SALE VALUE:</Text>
          <Text style={styles.totalValue}>Ksh {totalAmount.toLocaleString()}</Text>
        </View>

        {/* 4. Payment Method Selector */}
        <Text style={styles.fieldLabel}>4. PAYMENT METHOD</Text>
        <View style={styles.paymentMethodRow}>
          {/* Cash */}
          <TouchableOpacity 
            style={[
              styles.paymentTab, 
              paymentMethod === 'CASH' && styles.paymentTabActiveCash
            ]}
            onPress={() => setPaymentMethod('CASH')}
          >
            <MaterialCommunityIcons 
              name="cash-multiple" 
              size={18} 
              color={paymentMethod === 'CASH' ? '#FFFFFF' : '#059669'} 
            />
            <Text style={[styles.paymentTabText, paymentMethod === 'CASH' && styles.textWhite]}>
              CASH
            </Text>
          </TouchableOpacity>

          {/* M-Pesa */}
          <TouchableOpacity 
            style={[
              styles.paymentTab, 
              paymentMethod === 'MPESA' && styles.paymentTabActiveMpesa
            ]}
            onPress={() => setPaymentMethod('MPESA')}
          >
            <Ionicons 
              name="phone-portrait" 
              size={16} 
              color={paymentMethod === 'MPESA' ? '#FFFFFF' : '#15803D'} 
            />
            <Text style={[styles.paymentTabText, paymentMethod === 'MPESA' && styles.textWhite]}>
              M-PESA
            </Text>
          </TouchableOpacity>

          {/* Credit */}
          <TouchableOpacity 
            style={[
              styles.paymentTab, 
              paymentMethod === 'CREDIT' && styles.paymentTabActiveCredit
            ]}
            onPress={() => setPaymentMethod('CREDIT')}
          >
            <Ionicons 
              name="time" 
              size={16} 
              color={paymentMethod === 'CREDIT' ? '#FFFFFF' : '#D97706'} 
            />
            <Text style={[styles.paymentTabText, paymentMethod === 'CREDIT' && styles.textWhite]}>
              CREDIT (DENI)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Additional Customer Fields for M-Pesa or Credit */}
        {paymentMethod === 'MPESA' && (
          <View style={styles.auxFields}>
            <TextInput
              style={styles.auxInput}
              placeholder="M-Pesa Ref (e.g. QJK891M3KL) or Sender Phone"
              value={mpesaCode}
              onChangeText={setMpesaCode}
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        )}

        {paymentMethod === 'CREDIT' && (
          <View style={styles.auxFields}>
            <TextInput
              style={styles.auxInput}
              placeholder="Customer Name (e.g. Mama Njoroge / Kariokor Hotel)"
              value={buyerName}
              onChangeText={setBuyerName}
              placeholderTextColor={THEME.colors.textMuted}
            />
            <TextInput
              style={[styles.auxInput, { marginTop: 6 }]}
              placeholder="Customer Phone (for Kenya DPA encrypted debt ledger)"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        )}

        {/* Submit Sale Button */}
        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSubmitSale}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
          <Text style={styles.submitButtonText}>
            CONFIRM SALE • KSH {totalAmount.toLocaleString()}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: THEME.spacing.lg,
    marginVertical: THEME.spacing.md,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  sellerRoleTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  gradeToggleGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  gradeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  gradeButtonActiveG1: {
    backgroundColor: '#881337',
    borderColor: '#881337',
  },
  gradeButtonActiveG2: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  gradeButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  gradeButtonSub: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textWhiteLight: {
    color: '#FDE68A',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    gap: 8,
  },
  qtyAdjustBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  qtyDisplayBox: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  qtyDisplayText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  qtyDisplayUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  presetPill: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730A3',
  },
  priceSection: {
    marginBottom: THEME.spacing.md,
  },
  priceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  negotiationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  negotiationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  currencyPrefix: {
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  currencyPrefixText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  priceInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  bargainChip: {
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bargainChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: THEME.spacing.md,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#78350F',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  paymentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  paymentTabActiveCash: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  paymentTabActiveMpesa: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  paymentTabActiveCredit: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  paymentTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  auxFields: {
    marginBottom: THEME.spacing.md,
  },
  auxInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  submitButton: {
    backgroundColor: THEME.colors.primary,
    height: 54,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  }
});

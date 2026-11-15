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
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { MARKET_CONFIG } from '../constants/config';

export const SalesLogger: React.FC = () => {
  const { 
    currentBatch, 
    batchProducts, 
    recordSale, 
    role, 
    currentUserId,
    currentUserName, 
    currentUserPhone, 
    allocations,
    isDarkMode,
    acceptedPaymentModes,
  } = useAppStore(
    useShallow((s) => ({
      currentBatch: s.currentBatch,
      batchProducts: s.batchProducts,
      recordSale: s.recordSale,
      role: s.role,
      currentUserId: s.currentUserId,
      currentUserName: s.currentUserName,
      currentUserPhone: s.currentUserPhone,
      allocations: s.allocations,
      isDarkMode: s.isDarkMode,
      acceptedPaymentModes: s.acceptedPaymentModes,
    }))
  );

  const paymentModes = acceptedPaymentModes || { CASH: true, MPESA: true, CREDIT: true };

  const isSeller = role === 'SELLER';
  const sellerAllocation = allocations?.find(
    (a) =>
      a.sellerId === currentUserId ||
      a.sellerName.toLowerCase().includes((currentUserName || '').toLowerCase()) ||
      (currentUserName || '').toLowerCase().includes(a.sellerName.toLowerCase())
  ) || allocations?.[0];

  const g1Allocated = sellerAllocation?.grade1Allocated || 0;
  const g1Sold = sellerAllocation?.grade1Sold || 0;
  const g1RemainingSeller = Math.max(0, g1Allocated - g1Sold);

  const g2Allocated = sellerAllocation?.grade2Allocated || 0;
  const g2Sold = sellerAllocation?.grade2Sold || 0;
  const g2RemainingSeller = Math.max(0, g2Allocated - g2Sold);

  const [selectedGrade, setSelectedGrade] = useState<ProduceGrade>('GRADE_1');

  const availableStock = isSeller
    ? (selectedGrade === 'GRADE_1' ? g1RemainingSeller : g2RemainingSeller)
    : (selectedGrade === 'GRADE_1' ? (currentBatch?.remainingGrade1Nets || 0) : (currentBatch?.remainingGrade2Nets || 0));

  const totalStockForGrade = isSeller
    ? (selectedGrade === 'GRADE_1' ? g1Allocated : g2Allocated)
    : (selectedGrade === 'GRADE_1' ? (currentBatch?.initialGrade1Nets || 0) : (currentBatch?.initialGrade2Nets || 0));

  const [quantity, setQuantity] = useState<number>(5);

  const getBatchPriceForGrade = (grade: ProduceGrade) => {
    if (grade === 'GRADE_1') {
      return currentBatch?.pricePerBagGrade1 ?? MARKET_CONFIG.grades.GRADE_1.defaultBaselinePrice;
    }
    return currentBatch?.pricePerBagGrade2 ?? MARKET_CONFIG.grades.GRADE_2.defaultBaselinePrice;
  };

  const getMinPriceForGrade = (grade: ProduceGrade) => {
    if (grade === 'GRADE_1') {
      return currentBatch?.minPriceGrade1 ?? 1000;
    }
    return currentBatch?.minPriceGrade2 ?? 600;
  };

  const activeBatchPrice = getBatchPriceForGrade(selectedGrade);
  const activeMinFloor = getMinPriceForGrade(selectedGrade);

  const [unitPrice, setUnitPrice] = useState<string>(
    (currentBatch?.pricePerBagGrade1 ?? MARKET_CONFIG.grades.GRADE_1.defaultBaselinePrice).toString()
  );

  // Sync unit price when active batch price or grade changes
  React.useEffect(() => {
    setUnitPrice(getBatchPriceForGrade(selectedGrade).toString());
  }, [selectedGrade, currentBatch?.pricePerBagGrade1, currentBatch?.pricePerBagGrade2]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Keep selected paymentMethod aligned with Master's acceptedPaymentModes
  React.useEffect(() => {
    if (!paymentModes[paymentMethod]) {
      const firstActive = (['CASH', 'MPESA', 'CREDIT'] as PaymentMethod[]).find((m) => paymentModes[m]);
      if (firstActive) {
        setPaymentMethod(firstActive);
      }
    }
  }, [paymentModes.CASH, paymentModes.MPESA, paymentModes.CREDIT, paymentMethod]);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [buyerNationalId, setBuyerNationalId] = useState<string>('');
  const [mpesaCode, setMpesaCode] = useState<string>('');

  // Credit Liability & Consent Verification State
  const [creditAuthMode, setCreditAuthMode] = useState<'SMS' | 'GUARANTOR'>('SMS');
  const [smsSent, setSmsSent] = useState<boolean>(false);
  const [buyerAgreed, setBuyerAgreed] = useState<boolean>(false);
  const [guarantorName, setGuarantorName] = useState<string>(currentUserName);
  const [guarantorPhone, setGuarantorPhone] = useState<string>(currentUserPhone);
  const [guarantorNationalId, setGuarantorNationalId] = useState<string>('24918230');
  const [guarantorConsentChecked, setGuarantorConsentChecked] = useState<boolean>(false);

  if (!currentBatch || !batchProducts || batchProducts.length === 0) return null;

  const numericPrice = parseFloat(unitPrice) || 0;
  const totalAmount = quantity * numericPrice;

  // Credit is authorized if debtor ID is provided AND either:
  // 1. Debtor received SMS and agreed via "YES" reply
  // 2. Seller / Merchant provides their details + Kenyan ID and checks liability guarantor box
  const isCreditAuthorized = paymentMethod !== 'CREDIT' || (
    buyerNationalId.trim().length >= 6 && (
      creditAuthMode === 'SMS' 
        ? buyerAgreed 
        : (guarantorConsentChecked && guarantorName.trim().length > 0 && guarantorPhone.trim().length > 0 && guarantorNationalId.trim().length >= 6)
    )
  );

  const handleGradeSelect = (grade: ProduceGrade) => {
    setSelectedGrade(grade);
    const baseline = getBatchPriceForGrade(grade);
    setUnitPrice(baseline.toString());
  };

  const adjustQuantity = (delta: number) => {
    setQuantity(prev => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (availableStock > 0 && next > availableStock) {
        Alert.alert(
          'Maximum Stock Limit',
          isSeller 
            ? `You only have ${availableStock} nets remaining in your assigned quota.`
            : `Only ${availableStock} nets remaining in batch stock.`
        );
        return availableStock;
      }
      return next;
    });
  };

  const adjustPrice = (delta: number) => {
    const current = parseFloat(unitPrice) || 0;
    const minAllowed = getMinPriceForGrade(selectedGrade);
    const next = Math.max(minAllowed, current + delta);
    setUnitPrice(next.toString());
  };

  const handleSendCreditAgreementSms = () => {
    if (!buyerName.trim()) {
      Alert.alert('Customer Name Required', 'Please enter the debtor name before sending credit agreement SMS.');
      return;
    }
    if (!buyerPhone.trim()) {
      Alert.alert('Customer Phone Required', 'Please enter the debtor phone number to dispatch the liability SMS.');
      return;
    }
    if (!buyerNationalId.trim()) {
      Alert.alert('Kenyan National ID Required', 'Please enter the debtor\'s Kenyan National ID number (e.g. 28394812).');
      return;
    }

    const gradeLabel = selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2';
    const truck = currentBatch.truckPlate;
    const smsMessage = `THE GEM / WAKULIMA MARKET: Credit liability notice for ${buyerName.trim()} (ID: ${buyerNationalId.trim()}). You are receiving ${quantity} nets of ${gradeLabel} on credit totaling KSH ${totalAmount.toLocaleString()} from Truck ${truck}. You are legally liable for this debt. Repayment is tracked in the market ledger. Reply YES to accept liability and confirm sale.`;

    setSmsSent(true);
    setBuyerAgreed(false);

    Alert.alert(
      '📲 Credit Agreement SMS Dispatched',
      `Sent to ${buyerPhone.trim()} (ID: ${buyerNationalId.trim()}):\n\n"${smsMessage}"\n\nAwaiting debtor confirmation. You can simulate the "YES" reply below to complete this transaction.`
    );
  };

  const handleSimulateBuyerConsent = () => {
    setBuyerAgreed(true);
    Alert.alert(
      '✅ Debtor Liability Confirmed',
      `${buyerName.trim() || 'Debtor'} (ID: ${buyerNationalId.trim() || 'ID Verified'}) has replied "YES" via SMS agreeing to pay KSH ${totalAmount.toLocaleString()}.\n\nCredit liability is legally established. You may now confirm the credit sale!`
    );
  };

  const handleAutofillSelfGuarantor = () => {
    setGuarantorName(currentUserName);
    setGuarantorPhone(currentUserPhone);
    setGuarantorNationalId('24918230');
    setGuarantorConsentChecked(true);
  };

  const handleSubmitSale = async () => {
    if (quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please specify at least 1 net.');
      return;
    }

    if (availableStock <= 0) {
      Alert.alert(
        'No Stock Available',
        isSeller
          ? `You have 0 nets of ${selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} remaining in your assigned quota. Contact Master to allocate stock.`
          : `There are 0 nets of ${selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} remaining in batch stock.`
      );
      return;
    }

    if (quantity > availableStock) {
      Alert.alert(
        'Insufficient Stock',
        isSeller
          ? `You only have ${availableStock} nets remaining in your assigned quota. You cannot record a sale of ${quantity} nets.`
          : `Only ${availableStock} nets remaining in batch stock.`
      );
      return;
    }

    if (numericPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid negotiated price per net.');
      return;
    }

    const minAllowed = getMinPriceForGrade(selectedGrade);
    if (minAllowed > 0 && numericPrice < minAllowed) {
      Alert.alert(
        '⚠️ Price Below Minimum Floor',
        `The Master has set the minimum allowed price for ${selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} at Ksh ${minAllowed.toLocaleString()} per net. You cannot record a sale below this minimum purchase price.`
      );
      return;
    }

    if (paymentMethod === 'CREDIT') {
      if (!buyerName.trim()) {
        Alert.alert('Customer Name Required', 'Credit sales require debtor name to track outstanding debt.');
        return;
      }
      if (!buyerPhone.trim()) {
        Alert.alert('Customer Phone Required', 'Credit sales require debtor phone for Kenya DPA debt tracking.');
        return;
      }
      if (!buyerNationalId.trim()) {
        Alert.alert('Kenyan National ID Required', 'Please enter debtor Kenyan National ID number.');
        return;
      }
      if (creditAuthMode === 'GUARANTOR' && !guarantorNationalId.trim()) {
        Alert.alert('Guarantor National ID Required', 'Please enter the guarantor\'s Kenyan National ID number.');
        return;
      }
      if (!isCreditAuthorized) {
        if (creditAuthMode === 'SMS') {
          Alert.alert(
            'Debtor Agreement Required',
            'Please dispatch the credit agreement SMS and confirm debtor consent ("YES" reply) before recording this credit sale.'
          );
        } else {
          Alert.alert(
            'Guarantor Liability Required',
            'Please verify guarantor details and check the liability guarantee box to authorize this credit sale.'
          );
        }
        return;
      }
    }

    const res = await recordSale({
      grade: selectedGrade,
      quantityNets: quantity,
      negotiatedUnitPrice: numericPrice,
      paymentMethod,
      buyerName: buyerName.trim() || undefined,
      buyerPhone: buyerPhone.trim() || undefined,
      buyerNationalId: buyerNationalId.trim() || undefined,
      mpesaReceiptCode: mpesaCode.trim() || undefined,
      buyerConsentConfirmed: paymentMethod === 'CREDIT' && creditAuthMode === 'SMS' && buyerAgreed,
      guarantorAccepted: paymentMethod === 'CREDIT' && creditAuthMode === 'GUARANTOR' ? guarantorConsentChecked : true,
    });

    if (res.success) {
      if (paymentMethod === 'MPESA') {
        const customerName = buyerName.trim() || 'Customer';
        const gradeText = selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2';
        const confirmationSms = `Confirmed. Ksh ${totalAmount.toLocaleString()} received for ${quantity} nets of ${gradeText}. Thank you ${customerName} for purchasing from The Gem (Wakulima Market). Karibu tena!`;

        Alert.alert(
          '✅ M-Pesa Payment Received',
          `Funds credited directly to Master Account.\nTotal: Ksh ${totalAmount.toLocaleString()}\n\n📲 Confirmation & Thank-You SMS sent to buyer (${buyerPhone || 'Customer'}):\n"${confirmationSms}"`,
          [{ text: 'OK' }]
        );
      } else if (paymentMethod === 'CREDIT') {
        const authDesc = creditAuthMode === 'SMS'
          ? `📲 Debtor SMS Agreement Confirmed (${buyerName.trim()}, ID: ${buyerNationalId.trim()})`
          : `🛡️ Guaranteed by ${guarantorName.trim()} (ID: ${guarantorNationalId.trim()})`;

        if (role === 'SELLER') {
          Alert.alert(
            '📤 Credit Sale Submitted for Master Approval',
            `Credit sale of ${quantity} nets (Ksh ${totalAmount.toLocaleString()}) recorded.\nDebtor: ${buyerName.trim()} (ID: ${buyerNationalId.trim()})\n\n🔔 A live notification has been dispatched to Master for immediate review and approval.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '✅ Credit Sale Confirmed & Tracked',
            `${res.message}\nTotal Debt: Ksh ${totalAmount.toLocaleString()}\nAuthorization: ${authDesc}\nLinked to Truck: ${currentBatch.truckPlate} (${currentBatch.origin.regionName})`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          '✅ Sale Recorded',
          `${res.message}\nTotal: Ksh ${totalAmount.toLocaleString()} (${paymentMethod})`,
          [{ text: 'OK' }]
        );
      }
      // Reset fields for next transaction
      setQuantity(1);
      setBuyerName('');
      setBuyerPhone('');
      setBuyerNationalId('');
      setMpesaCode('');
      setSmsSent(false);
      setBuyerAgreed(false);
      setGuarantorConsentChecked(false);
    } else {
      Alert.alert('Sale Error', res.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        <View style={[styles.header, isDarkMode && styles.headerDark]}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="cash-register" size={20} color={isDarkMode ? '#22D3EE' : THEME.colors.primary} />
            <Text style={[styles.headerTitle, isDarkMode && { color: '#22D3EE' }]}>RECORD SALE (SAJILI MAUZO)</Text>
          </View>
          <Text style={styles.sellerRoleTag}>
            {role === 'MERCHANT' ? 'Master Direct' : 'Seller Mode'}
          </Text>
        </View>

        {/* 1. Grade Selector */}
        <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>1. SELECT PRODUCE GRADE</Text>
        <View style={styles.gradeToggleGroup}>
          <TouchableOpacity 
            style={[
              styles.gradeButton, 
              isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
              selectedGrade === 'GRADE_1' && styles.gradeButtonActiveG1
            ]}
            onPress={() => handleGradeSelect('GRADE_1')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.gradeButtonTitle, 
              isDarkMode && { color: '#F8FAFC' },
              selectedGrade === 'GRADE_1' && styles.textWhite
            ]}>
              Grade 1
            </Text>
            <Text style={[
              styles.gradeButtonSub, 
              isDarkMode && { color: '#CBD5E1' },
              selectedGrade === 'GRADE_1' && styles.textWhiteLight
            ]}>
              {isSeller 
                ? `Assigned: ${g1RemainingSeller}/${g1Allocated} nets` 
                : `Batch: Ksh ${getBatchPriceForGrade('GRADE_1').toLocaleString()}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.gradeButton, 
              isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
              selectedGrade === 'GRADE_2' && styles.gradeButtonActiveG2
            ]}
            onPress={() => handleGradeSelect('GRADE_2')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.gradeButtonTitle, 
              isDarkMode && { color: '#F8FAFC' },
              selectedGrade === 'GRADE_2' && styles.textWhite
            ]}>
              Grade 2
            </Text>
            <Text style={[
              styles.gradeButtonSub, 
              isDarkMode && { color: '#CBD5E1' },
              selectedGrade === 'GRADE_2' && styles.textWhiteLight
            ]}>
              {isSeller 
                ? `Assigned: ${g2RemainingSeller}/${g2Allocated} nets` 
                : `Batch: Ksh ${getBatchPriceForGrade('GRADE_2').toLocaleString()}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Quantity (Nets / Sacks) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>2. NUMBER OF NETS / SACKS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="cube-outline" size={13} color={isSeller ? '#0891B2' : '#059669'} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#38BDF8' : '#0891B2' }}>
              {isSeller 
                ? `Assigned: ${availableStock} / ${totalStockForGrade} nets` 
                : `Batch Stock: ${availableStock} nets`}
            </Text>
          </View>
        </View>
        <View style={styles.quantityRow}>
          <TouchableOpacity 
            style={[styles.qtyAdjustBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} 
            onPress={() => adjustQuantity(-1)}
          >
            <Ionicons name="remove" size={22} color={isDarkMode ? '#F8FAFC' : THEME.colors.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.qtyDisplayBox, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
            <Text style={[styles.qtyDisplayText, isDarkMode && { color: '#F8FAFC' }]}>{quantity}</Text>
            <Text style={[styles.qtyDisplayUnit, isDarkMode && { color: '#38BDF8' }]}>NETS</Text>
          </View>

          <TouchableOpacity 
            style={[styles.qtyAdjustBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} 
            onPress={() => adjustQuantity(1)}
          >
            <Ionicons name="add" size={22} color={isDarkMode ? '#F8FAFC' : THEME.colors.textPrimary} />
          </TouchableOpacity>

          {/* Quick preset buttons */}
          <View style={styles.presetsRow}>
            {[5, 10, 20].map(val => (
              <TouchableOpacity 
                key={val} 
                style={[
                  styles.presetPill, 
                  isDarkMode && { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
                  availableStock > 0 && val > availableStock && { opacity: 0.5 }
                ]} 
                onPress={() => {
                  if (availableStock > 0 && val > availableStock) {
                    setQuantity(availableStock);
                  } else {
                    setQuantity(val);
                  }
                }}
              >
                <Text style={[styles.presetPillText, isDarkMode && { color: '#38BDF8' }]}>+{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 3. Dynamic Negotiated Price */}
        <View style={styles.priceSection}>
          <View style={styles.priceHeaderRow}>
            <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>3. NEGOTIATED PRICE PER NET (KSH)</Text>
            <View style={styles.negotiationBadge}>
              <Ionicons name="swap-horizontal" size={12} color="#059669" />
              <Text style={styles.negotiationBadgeText}>Bargained Rate</Text>
            </View>
          </View>

          <View style={styles.priceInputRow}>
            <View style={[styles.currencyPrefix, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
              <Text style={[styles.currencyPrefixText, isDarkMode && { color: '#F8FAFC' }]}>KSH</Text>
            </View>
            <TextInput
              style={[styles.priceInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#0891B2', color: '#F8FAFC' }]}
              keyboardType="numeric"
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="e.g. 1300"
              placeholderTextColor={THEME.colors.textMuted}
            />
            {/* Quick bargain adjust buttons */}
            <TouchableOpacity style={[styles.bargainChip, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]} onPress={() => adjustPrice(-50)}>
              <Text style={[styles.bargainChipText, isDarkMode && { color: '#F8FAFC' }]}>-50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bargainChip, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]} onPress={() => adjustPrice(+50)}>
              <Text style={[styles.bargainChipText, isDarkMode && { color: '#F8FAFC' }]}>+50</Text>
            </TouchableOpacity>
          </View>

          {/* Master Sourced Price & Minimum Purchase Floor Indicator */}
          <View style={styles.masterPriceIndicatorRow}>
            <Text style={[styles.masterPriceText, isDarkMode && { color: '#94A3B8' }]}>
              Master Price: <Text style={{ fontWeight: '700', color: isDarkMode ? '#38BDF8' : '#0891B2' }}>Ksh {activeBatchPrice.toLocaleString()}</Text> • Min Floor: <Text style={{ fontWeight: '700', color: '#D97706' }}>Ksh {activeMinFloor.toLocaleString()}</Text>
            </Text>
            {numericPrice > 0 && numericPrice < activeMinFloor && (
              <Text style={styles.floorWarningText}>⚠️ Cannot sell below Master's minimum price of Ksh {activeMinFloor.toLocaleString()}</Text>
            )}
          </View>
        </View>

        {/* Live Calculation Banner */}
        <View style={[styles.totalBanner, isDarkMode && { backgroundColor: '#2E1E05', borderColor: '#F59E0B' }]}>
          <Text style={[styles.totalLabel, isDarkMode && { color: '#FDE68A' }]}>TOTAL SALE VALUE:</Text>
          <Text style={[styles.totalValue, isDarkMode && { color: '#FBBF24' }]}>Ksh {totalAmount.toLocaleString()}</Text>
        </View>

        {/* 4. Payment Method Selector */}
        <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>4. PAYMENT METHOD</Text>
        <View style={styles.paymentMethodRow}>
          {/* Cash */}
          <TouchableOpacity 
            disabled={!paymentModes.CASH}
            style={[
              styles.paymentTab, 
              isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' },
              paymentMethod === 'CASH' && styles.paymentTabActiveCash,
              !paymentModes.CASH && { opacity: 0.4 },
            ]}
            onPress={() => setPaymentMethod('CASH')}
          >
            <MaterialCommunityIcons 
              name="cash-multiple" 
              size={18} 
              color={paymentMethod === 'CASH' ? '#FFFFFF' : '#059669'} 
            />
            <Text style={[styles.paymentTabText, isDarkMode && { color: '#CFE9EC' }, paymentMethod === 'CASH' && styles.textWhite]}>
              CASH
            </Text>
          </TouchableOpacity>

          {/* M-Pesa */}
          <TouchableOpacity 
            disabled={!paymentModes.MPESA}
            style={[
              styles.paymentTab, 
              isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' },
              paymentMethod === 'MPESA' && styles.paymentTabActiveMpesa,
              !paymentModes.MPESA && { opacity: 0.4 },
            ]}
            onPress={() => setPaymentMethod('MPESA')}
          >
            <Ionicons 
              name="phone-portrait" 
              size={16} 
              color={paymentMethod === 'MPESA' ? '#FFFFFF' : '#15803D'} 
            />
            <Text style={[styles.paymentTabText, isDarkMode && { color: '#CFE9EC' }, paymentMethod === 'MPESA' && styles.textWhite]}>
              M-PESA
            </Text>
          </TouchableOpacity>

          {/* Credit */}
          <TouchableOpacity 
            disabled={!paymentModes.CREDIT}
            style={[
              styles.paymentTab, 
              isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' },
              paymentMethod === 'CREDIT' && styles.paymentTabActiveCredit,
              !paymentModes.CREDIT && { opacity: 0.4 },
            ]}
            onPress={() => setPaymentMethod('CREDIT')}
          >
            <Ionicons 
              name="time" 
              size={16} 
              color={paymentMethod === 'CREDIT' ? '#FFFFFF' : '#D97706'} 
            />
            <Text style={[styles.paymentTabText, isDarkMode && { color: '#CFE9EC' }, paymentMethod === 'CREDIT' && styles.textWhite]}>
              CREDIT (DENI)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Additional Customer Fields for M-Pesa or Credit */}
        {paymentMethod === 'MPESA' && (
          <View style={styles.auxFields}>
            <TextInput
              style={[styles.auxInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
              placeholder="M-Pesa Ref (e.g. QJK891M3KL) or Sender Phone"
              value={mpesaCode}
              onChangeText={setMpesaCode}
              placeholderTextColor={THEME.colors.textMuted}
            />
          </View>
        )}

        {paymentMethod === 'CREDIT' && (
          <View style={styles.auxFields}>
            <Text style={[styles.creditSubLabel, isDarkMode && { color: '#CBD5E1' }]}>
              DEBTOR CONTACT INFORMATION
            </Text>
            <TextInput
              style={[styles.auxInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
              placeholder="Customer Name (e.g. Mama Njoroge / Kariokor Hotel)"
              value={buyerName}
              onChangeText={setBuyerName}
              placeholderTextColor={THEME.colors.textMuted}
            />
            <TextInput
              style={[styles.auxInput, { marginTop: 6 }, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
              placeholder="Customer Phone (e.g. 0712345678)"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
              placeholderTextColor={THEME.colors.textMuted}
            />
            <TextInput
              style={[styles.auxInput, { marginTop: 6 }, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
              placeholder="Debtor Kenyan National ID (e.g. 28394812)"
              value={buyerNationalId}
              onChangeText={setBuyerNationalId}
              keyboardType="numeric"
              maxLength={8}
              placeholderTextColor={THEME.colors.textMuted}
            />

            {/* Credit Liability Verification Box */}
            <View style={[styles.creditAuthBox, isDarkMode && styles.creditAuthBoxDark]}>
              <View style={styles.creditAuthHeaderRow}>
                <MaterialCommunityIcons 
                  name={isCreditAuthorized ? "shield-check" : "shield-alert"} 
                  size={18} 
                  color={isCreditAuthorized ? "#10B981" : "#F59E0B"} 
                />
                <Text style={[styles.creditAuthTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  LIABILITY VERIFICATION
                </Text>
                <View style={[
                  styles.statusPill, 
                  isCreditAuthorized ? styles.statusPillApproved : styles.statusPillPending
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    isCreditAuthorized ? styles.statusPillTextApproved : styles.statusPillTextPending
                  ]}>
                    {isCreditAuthorized ? 'UNLOCKED' : 'LOCKED'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.creditAuthExplanation, isDarkMode && { color: '#94A3B8' }]}>
                To record this credit sale under Kenya DPA, either the debtor must acknowledge liability via SMS agreement, or an authorized guarantor must sign off.
              </Text>

              {/* Mode Switcher */}
              <View style={[styles.creditAuthTabs, isDarkMode && { backgroundColor: '#0F172A' }]}>
                <TouchableOpacity
                  style={[
                    styles.creditAuthTab,
                    creditAuthMode === 'SMS' && styles.creditAuthTabActive,
                    creditAuthMode === 'SMS' && isDarkMode && styles.creditAuthTabActiveDark
                  ]}
                  onPress={() => setCreditAuthMode('SMS')}
                >
                  <Ionicons 
                    name="chatbubble-ellipses" 
                    size={14} 
                    color={creditAuthMode === 'SMS' ? '#0891B2' : (isDarkMode ? '#94A3B8' : '#64748B')} 
                  />
                  <Text style={[
                    styles.creditAuthTabText,
                    creditAuthMode === 'SMS' && styles.creditAuthTabTextActive,
                    isDarkMode && { color: creditAuthMode === 'SMS' ? '#22D3EE' : '#94A3B8' }
                  ]}>
                    1. SMS Agreement
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.creditAuthTab,
                    creditAuthMode === 'GUARANTOR' && styles.creditAuthTabActive,
                    creditAuthMode === 'GUARANTOR' && isDarkMode && styles.creditAuthTabActiveDark
                  ]}
                  onPress={() => setCreditAuthMode('GUARANTOR')}
                >
                  <Ionicons 
                    name="shield" 
                    size={14} 
                    color={creditAuthMode === 'GUARANTOR' ? '#0891B2' : (isDarkMode ? '#94A3B8' : '#64748B')} 
                  />
                  <Text style={[
                    styles.creditAuthTabText,
                    creditAuthMode === 'GUARANTOR' && styles.creditAuthTabTextActive,
                    isDarkMode && { color: creditAuthMode === 'GUARANTOR' ? '#22D3EE' : '#94A3B8' }
                  ]}>
                    2. Guarantor Liability
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: SMS AGREEMENT */}
              {creditAuthMode === 'SMS' && (
                <View style={styles.authModePanel}>
                  {!smsSent ? (
                    <TouchableOpacity
                      style={styles.sendSmsBtn}
                      onPress={handleSendCreditAgreementSms}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
                      <Text style={styles.sendSmsBtnText}>
                        Send Liability Agreement SMS
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.smsWorkflowContainer}>
                      <View style={[styles.smsStatusCard, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' }]}>
                        <View style={styles.smsSentRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#059669" />
                          <Text style={[styles.smsSentText, isDarkMode && { color: '#E2E8F0' }]}>
                            Agreement SMS sent to {buyerPhone}
                          </Text>
                        </View>
                        <Text style={[styles.smsAwaitingText, isDarkMode && { color: '#94A3B8' }]}>
                          Debtor was asked to reply "YES" to confirm debt of Ksh {totalAmount.toLocaleString()} from Truck {currentBatch.truckPlate}.
                        </Text>
                      </View>

                      {!buyerAgreed ? (
                        <TouchableOpacity
                          style={styles.simulateReplyBtn}
                          onPress={handleSimulateBuyerConsent}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="cellphone-message" size={16} color="#0891B2" />
                          <Text style={styles.simulateReplyBtnText}>
                            Simulate Debtor Reply "YES" (Accept Liability)
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.verifiedConsentCard, isDarkMode && { backgroundColor: '#064E3B', borderColor: '#059669' }]}>
                          <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.verifiedConsentTitle, isDarkMode && { color: '#ECFDF5' }]}>
                              Debtor SMS Agreement Confirmed!
                            </Text>
                            <Text style={[styles.verifiedConsentDesc, isDarkMode && { color: '#A7F3D0' }]}>
                              {buyerName || 'Debtor'} has officially agreed to the debt and tracking. Sale unlocked.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: GUARANTOR LIABILITY */}
              {creditAuthMode === 'GUARANTOR' && (
                <View style={styles.authModePanel}>
                  <View style={styles.guarantorHeaderRow}>
                    <Text style={[styles.guarantorInstruction, isDarkMode && { color: '#94A3B8' }]}>
                      Seller or Master pledges personal liability for this debt:
                    </Text>
                    <TouchableOpacity
                      style={styles.autofillBtn}
                      onPress={handleAutofillSelfGuarantor}
                    >
                      <Ionicons name="person" size={11} color="#0891B2" />
                      <Text style={styles.autofillBtnText}>Use My Details</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.auxInput, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
                    placeholder="Guarantor Full Name"
                    value={guarantorName}
                    onChangeText={setGuarantorName}
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                  <TextInput
                    style={[styles.auxInput, { marginTop: 6 }, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
                    placeholder="Guarantor Phone Number"
                    value={guarantorPhone}
                    onChangeText={setGuarantorPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                  <TextInput
                    style={[styles.auxInput, { marginTop: 6 }, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }]}
                    placeholder="Guarantor Kenyan National ID (e.g. 24918230)"
                    value={guarantorNationalId}
                    onChangeText={setGuarantorNationalId}
                    keyboardType="numeric"
                    maxLength={8}
                    placeholderTextColor={THEME.colors.textMuted}
                  />

                  {/* Legal Guarantee Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.guarantorCheckboxRow, 
                      isDarkMode && { backgroundColor: '#0F172A', borderColor: '#334155' },
                      guarantorConsentChecked && styles.guarantorCheckboxRowActive
                    ]}
                    onPress={() => setGuarantorConsentChecked(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={guarantorConsentChecked ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={guarantorConsentChecked ? "#059669" : (isDarkMode ? "#94A3B8" : "#64748B")} 
                    />
                    <Text style={[
                      styles.guarantorCheckboxLabel,
                      isDarkMode && { color: '#E2E8F0' },
                      guarantorConsentChecked && { fontWeight: '700' }
                    ]}>
                      I, <Text style={styles.boldText}>{guarantorName || 'Guarantor'}</Text> (ID: {guarantorNationalId || 'N/A'}, {role === 'MERCHANT' ? 'Master' : 'Seller'}), formally agree to be personally & financially liable for Ksh {totalAmount.toLocaleString()} if {buyerName || 'the debtor'} (ID: {buyerNationalId || 'N/A'}) defaults.
                    </Text>
                  </TouchableOpacity>

                  {guarantorConsentChecked && guarantorName.trim().length > 0 && guarantorPhone.trim().length > 0 && (
                    <View style={[styles.verifiedConsentCard, isDarkMode && { backgroundColor: '#064E3B', borderColor: '#059669' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.verifiedConsentTitle, isDarkMode && { color: '#ECFDF5' }]}>
                          Guarantor Backing Accepted!
                        </Text>
                        <Text style={[styles.verifiedConsentDesc, isDarkMode && { color: '#A7F3D0' }]}>
                          Liability formally attributed to {guarantorName} ({role === 'MERCHANT' ? 'Master' : 'Seller'}). Sale unlocked.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Submit Sale Button */}
        <TouchableOpacity 
          style={[
            styles.submitButton,
            !isCreditAuthorized && styles.submitButtonLocked
          ]} 
          onPress={handleSubmitSale}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={isCreditAuthorized ? "checkmark-circle" : "lock-closed"} 
            size={22} 
            color="#FFFFFF" 
          />
          <Text style={styles.submitButtonText}>
            {isCreditAuthorized 
              ? `CONFIRM SALE • KSH ${totalAmount.toLocaleString()}` 
              : `LOCKED • SMS OR GUARANTOR REQUIRED`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginVertical: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
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
  headerDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.35)',
  },
  fieldLabelDark: {
    color: '#F0FDFA',
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
    backgroundColor: '#0891B2', // Turquoise Blue
    borderColor: '#0891B2',
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
    color: '#CFFAFE',
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
  submitButtonLocked: {
    backgroundColor: '#64748B',
    shadowColor: '#334155',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  creditSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 2,
  },
  creditAuthBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creditAuthBoxDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  creditAuthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  creditAuthTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillApproved: {
    backgroundColor: '#ECFDF5',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusPillTextPending: {
    color: '#D97706',
  },
  statusPillTextApproved: {
    color: '#059669',
  },
  creditAuthExplanation: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
    marginBottom: 10,
  },
  creditAuthTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
    marginBottom: 10,
  },
  creditAuthTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
  },
  creditAuthTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  creditAuthTabActiveDark: {
    backgroundColor: '#1E293B',
  },
  creditAuthTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  creditAuthTabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  authModePanel: {
    marginTop: 2,
  },
  sendSmsBtn: {
    backgroundColor: '#0891B2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  sendSmsBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  smsWorkflowContainer: {
    gap: 8,
  },
  smsStatusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  smsSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  smsSentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  smsAwaitingText: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  simulateReplyBtn: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  simulateReplyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369A1',
  },
  verifiedConsentCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedConsentTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  verifiedConsentDesc: {
    fontSize: 10,
    color: '#047857',
    marginTop: 2,
  },
  guarantorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guarantorInstruction: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  autofillBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  guarantorCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  guarantorCheckboxRowActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  guarantorCheckboxLabel: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    flex: 1,
    lineHeight: 15,
  },
  boldText: {
    fontWeight: '800',
  },
  masterPriceIndicatorRow: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  masterPriceText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  floorWarningText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 3,
  }
});

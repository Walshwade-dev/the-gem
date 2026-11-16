// ============================================================================
// The Gem: Real-Time Sales & Dynamic Bargaining Logger
// High-Contrast, Ergonomic Touch Targets for Fast-Paced Wakulima Market Trading
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  PermissionsAndroid,
  DeviceEventEmitter,
  NativeModules,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { ProduceGrade, PaymentMethod } from '../types';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { MARKET_CONFIG } from '../constants/config';
import { apiFetch, getApiBaseUrl } from '../services/api';
import { normalizeKenyaE164, sendDirectSimSms } from '../hooks/useSimSmsGateway';
import {
  buildCreditAgreementSms,
  buildPochiPaymentSms,
  buildThankYouReceiptSms,
} from '../utils/smsTemplates';

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
    customerCredits,
    isDarkMode,
    acceptedPaymentModes,
    pochiPhoneNumber,
    selectedSimSubId,
    simSmsGatewayEnabled,
    incrementSimSmsSent,
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
      customerCredits: s.customerCredits,
      isDarkMode: s.isDarkMode,
      acceptedPaymentModes: s.acceptedPaymentModes,
      pochiPhoneNumber: s.pochiPhoneNumber,
      selectedSimSubId: s.selectedSimSubId,
      simSmsGatewayEnabled: s.simSmsGatewayEnabled,
      incrementSimSmsSent: s.incrementSimSmsSent,
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
  const [gradeSwitchWidth, setGradeSwitchWidth] = useState<number>(0);
  const gradeSwitchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(gradeSwitchAnim, {
      toValue: selectedGrade === 'GRADE_1' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedGrade, gradeSwitchAnim]);

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
  const [isSubmittingSale, setIsSubmittingSale] = useState<boolean>(false);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState<boolean>(false);
  const [autoDetectedNotice, setAutoDetectedNotice] = useState<string | null>(null);
  const lastHandledSmsIdRef = useRef<string | null>(null);
  const [stkState, setStkState] = useState<{
    status: 'IDLE' | 'SENDING' | 'WAITING' | 'COMPLETE' | 'FAILED';
    requestId?: string;
    message?: string;
  }>({ status: 'IDLE' });

  useEffect(() => {
    if (stkState.status !== 'WAITING' || !stkState.requestId) return;
    let cancelled = false;
    let attempts = 0;

    const timer = setInterval(async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await apiFetch<{
          status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
          mpesaReceipt?: string | null;
          invoiceId?: string | null;
          failedReason?: string | null;
        }>(`/mpesa/stk-status/${stkState.requestId}`);

        if (cancelled) return;
        if (res.status === 'COMPLETE') {
          const code = (res.mpesaReceipt || res.invoiceId || '').toUpperCase().slice(0, 10);
          if (code) setMpesaCode(code);
          setAutoDetectedNotice(`STK Paid${code ? ` • ${code}` : ''}`);
          setStkState({
            status: 'COMPLETE',
            requestId: stkState.requestId,
            message: `M-Pesa payment confirmed${code ? ` (${code})` : ''}`,
          });
        } else if (res.status === 'FAILED') {
          setStkState({
            status: 'FAILED',
            requestId: stkState.requestId,
            message: res.failedReason || 'Customer cancelled or M-Pesa prompt failed.',
          });
        } else if (attempts >= 20) {
          setStkState({
            status: 'FAILED',
            requestId: stkState.requestId,
            message: 'Timed out waiting for M-Pesa PIN. Ask customer or retry.',
          });
        }
      } catch {
        if (attempts >= 20 && !cancelled) {
          setStkState({
            status: 'FAILED',
            requestId: stkState.requestId,
            message: 'Could not verify STK status. Check SMS or retry.',
          });
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stkState.status, stkState.requestId]);

  const [sendingPochiSms, setSendingPochiSms] = useState(false);

  const handleSendPochiSms = async () => {
    const cleanPhone = buyerPhone.trim();
    if (cleanPhone.replace(/\D/g, '').length < 9) {
      Alert.alert('Customer Phone Needed', 'Enter the customer phone number first.');
      return;
    }
    const qty = quantity || 0;
    const price = parseFloat(unitPrice) || 0;
    const amountKsh = Math.round(qty * price);
    if (amountKsh <= 0) {
      Alert.alert('Invalid Amount', 'Enter quantity and unit price before sending Pochi payment details.');
      return;
    }

    const pochiNum = (pochiPhoneNumber || '0115148000').trim();
    const itemDesc = `${qty}x ${selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'}${
      currentBatch?.truckPlate ? ` (${currentBatch.truckPlate})` : ''
    }`;
    const smsBody = buildPochiPaymentSms({
      pochiNumber: pochiNum,
      amountKsh,
      itemDesc,
      buyerName: buyerName.trim() || undefined,
    });

    setSendingPochiSms(true);
    try {
      const e164 = normalizeKenyaE164(cleanPhone);
      if (Platform.OS === 'android' && role === 'MERCHANT') {
        await sendDirectSimSms(e164, smsBody, selectedSimSubId);
        incrementSimSmsSent();
        Alert.alert('Pochi SMS Sent', `Sent Pochi (${pochiNum}) details for KES ${amountKsh.toLocaleString()} to ${e164} via SIM.`);
      } else {
        await apiFetch('/sms-gateway/send', {
          method: 'POST',
          body: {
            toPhoneE164: e164,
            bodyText: smsBody,
            template: 'POCHI_PAYMENT_DETAILS',
          },
        });
        Alert.alert('Pochi SMS Queued', `Queued Pochi (${pochiNum}) details for ${e164} on Master's SIM Gateway.`);
      }
    } catch (err) {
      Alert.alert('Pochi SMS Failed', err instanceof Error ? err.message : 'Could not send Pochi SMS');
    } finally {
      setSendingPochiSms(false);
    }
  };

  const handleSendStkPush = async () => {
    const cleanPhone = buyerPhone.trim();
    if (cleanPhone.replace(/\D/g, '').length < 9) {
      Alert.alert('Customer Phone Needed', 'Enter the customer M-Pesa phone number (e.g. 0712345678) first.');
      return;
    }
    const qty = quantity || 0;
    const price = parseFloat(unitPrice) || 0;
    const amountKsh = Math.round(qty * price);
    if (amountKsh <= 0) {
      Alert.alert('Invalid Amount', 'Enter quantity and unit price before sending an M-Pesa prompt.');
      return;
    }

    setStkState({ status: 'SENDING', message: 'Sending M-Pesa prompt...' });
    try {
      const res = await apiFetch<{
        requestId: string;
        phoneE164: string;
        amountKsh: number;
      }>('/mpesa/stk-push', {
        method: 'POST',
        body: {
          phoneNumber: cleanPhone,
          amountKsh,
          batchId: currentBatch?.id,
          assignmentId: isSeller ? sellerAllocation?.id : undefined,
        },
      });
      setStkState({
        status: 'WAITING',
        requestId: res.requestId,
        message: `Prompt sent to ${res.phoneE164} for Ksh ${res.amountKsh.toLocaleString()}. Waiting for PIN...`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send STK Push';
      setStkState({ status: 'FAILED', message: msg });
      Alert.alert('STK Push Failed', msg);
    }
  };

  const parseMpesaSms = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const codeMatch = text.match(/\b([A-Z0-9]{10})\b/);
    const phoneMatch = text.match(/(?:\+?254|0)(?:7|1)\d{8}/);
    const nameMatch = text.match(
      /(?:from|to)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})(?=\s+(?:\+?254|0)\d|\s+on\b|\s+for\b|\.|,|$)/i
    );
    if (codeMatch) setMpesaCode(codeMatch[1].toUpperCase());
    if (nameMatch?.[1]) setBuyerName(nameMatch[1].trim());
    if (phoneMatch?.[0]) setBuyerPhone(phoneMatch[0]);
    if (codeMatch || nameMatch?.[1]) {
      setAutoDetectedNotice(
        `Auto-filled ${codeMatch?.[1]?.toUpperCase() || ''}${nameMatch?.[1] ? ` • ${nameMatch[1].trim()}` : ''}`
      );
    }
  };

  const handleRequestSmsCapture = async () => {
    if (Platform.OS === 'android') {
      try {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);
        const granted =
          res[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED ||
          res[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
        setSmsPermissionGranted(granted);
        if (granted) {
          NativeModules.MpesaSmsModule?.startListening?.();
          Alert.alert(
            'SMS Auto-Detect Enabled',
            'Listening for incoming M-Pesa / Pochi la Biashara SMS notifications. When one arrives, the code and customer name will auto-fill.'
          );
        }
        return;
      } catch {
        // Ignore and enable dev listener fallback
      }
    }
    setSmsPermissionGranted(true);
    Alert.alert(
      'M-Pesa SMS Listener Active',
      'Listening for incoming M-Pesa confirmation notifications.'
    );
  };

  // Auto-detect incoming M-Pesa SMS (real Android BroadcastReceiver + __DEV__ simulator bridge)
  useEffect(() => {
    if (paymentMethod !== 'MPESA') return;

    if (Platform.OS === 'android') {
      NativeModules.MpesaSmsModule?.startListening?.();
    }

    const sub = DeviceEventEmitter.addListener(
      'onMpesaSmsReceived',
      (payload: { body?: string; message?: string }) => {
        const msgBody = payload?.body || payload?.message || '';
        if (msgBody) parseMpesaSms(msgBody);
      }
    );

    if (!__DEV__) {
      return () => {
        sub.remove();
      };
    }

    let cancelled = false;
    const pollSimulatedSms = async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/dev/latest-mpesa-sms`);
        if (!resp.ok) return;
        const json = (await resp.json()) as {
          sms?: { id: string; sender: string; body: string } | null;
        };
        if (!cancelled && json?.sms && json.sms.id !== lastHandledSmsIdRef.current) {
          lastHandledSmsIdRef.current = json.sms.id;
          parseMpesaSms(json.sms.body);
        }
      } catch {
        // Ignore polling network errors when offline
      }
    };

    const timer = setInterval(pollSimulatedSms, 2500);
    pollSimulatedSms();

    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [paymentMethod]);

  // Credit Liability & Consent Verification State
  const [creditAuthMode, setCreditAuthMode] = useState<'SMS' | 'GUARANTOR'>('SMS');
  const [smsSent, setSmsSent] = useState<boolean>(false);
  const [buyerAgreed, setBuyerAgreed] = useState<boolean>(false);
  const [guarantorName, setGuarantorName] = useState<string>(currentUserName);
  const [guarantorPhone, setGuarantorPhone] = useState<string>(currentUserPhone);
  const [guarantorNationalId, setGuarantorNationalId] = useState<string>('24918230');
  const [guarantorConsentChecked, setGuarantorConsentChecked] = useState<boolean>(false);

  // Auto-detect debtor "YES" SMS reply and automatically sign off credit acknowledgement
  useEffect(() => {
    if (paymentMethod !== 'CREDIT' || !smsSent || buyerAgreed) return;

    if (Platform.OS === 'android') {
      NativeModules.MpesaSmsModule?.startListening?.();
    }

    const sub = DeviceEventEmitter.addListener(
      'onCreditReplySmsReceived',
      (payload: { sender?: string; body?: string }) => {
        const senderDigits = (payload?.sender || '').replace(/\D/g, '').slice(-9);
        const buyerDigits = buyerPhone.replace(/\D/g, '').slice(-9);
        const matchesBuyer =
          buyerDigits.length >= 9 && senderDigits.length >= 9 && senderDigits === buyerDigits;
        if (matchesBuyer || !buyerDigits) {
          setBuyerAgreed(true);
          Alert.alert(
            '✅ Debtor "YES" Reply Collected',
            `${buyerName.trim() || 'Debtor'} (${payload?.sender || buyerPhone}) replied "${(payload?.body || 'YES').trim()}".\n\nCredit acknowledgement automatically signed off!`
          );
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, [paymentMethod, smsSent, buyerAgreed, buyerPhone, buyerName]);

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

  const handleSendCreditAgreementSms = async () => {
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
    const truck = currentBatch?.truckPlate || 'N/A';
    const smsMessage = buildCreditAgreementSms({
      buyerName: buyerName.trim(),
      nationalId: buyerNationalId.trim(),
      quantity,
      gradeLabel,
      totalAmount,
      truckPlate: truck,
    });

    if (Platform.OS === 'android') {
      try {
        const perm = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
        if (perm === PermissionsAndroid.RESULTS.GRANTED) {
          NativeModules.MpesaSmsModule?.startListening?.();
        }
      } catch {
        // Ignore
      }
    }

    let sentViaSim = false;
    if (Platform.OS === 'android' && simSmsGatewayEnabled) {
      try {
        const e164 = normalizeKenyaE164(buyerPhone.trim());
        await sendDirectSimSms(e164, smsMessage, selectedSimSubId);
        incrementSimSmsSent();
        sentViaSim = true;
      } catch {
        sentViaSim = false;
      }
    }

    setSmsSent(true);
    setBuyerAgreed(false);

    Alert.alert(
      sentViaSim ? '📲 Credit Agreement SMS Sent via SIM' : '📲 Credit Agreement SMS Queued',
      `To ${buyerPhone.trim()} (ID: ${buyerNationalId.trim()}):\n\n"${smsMessage}"\n\nListening automatically for the debtor's "YES" reply to sign off.`
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
    if (isSubmittingSale) return;
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

      // Block duplicate / new credit if customer has any existing unpaid credit
      const normId = buyerNationalId.trim().toLowerCase();
      const normPhone = buyerPhone.replace(/\D/g, '').slice(-9);
      const normName = buyerName.trim().toLowerCase();
      const existingCustomer = customerCredits.find((c) => {
        const cId = (c.customerNationalId || '').trim().toLowerCase();
        const cPhone = (c.customerPhone || '').replace(/\D/g, '').slice(-9);
        const cName = (c.customerName || '').trim().toLowerCase();
        return (
          (normId && cId && cId === normId) ||
          (normPhone.length >= 9 && cPhone.length >= 9 && cPhone === normPhone) ||
          (normName && cName === normName)
        );
      });
      const unpaidRecord = existingCustomer?.records.find(
        (r) => r.status !== 'SETTLED' && r.approvalStatus !== 'REJECTED' && r.totalOwed - r.amountPaid > 0
      );
      if (unpaidRecord) {
        const balance = Math.max(0, unpaidRecord.totalOwed - unpaidRecord.amountPaid);
        Alert.alert(
          'Existing Unpaid Credit',
          `${existingCustomer?.customerName || buyerName.trim()} already has an unpaid credit of Ksh ${balance.toLocaleString()}.\n\nThey must pay/settle the existing credit first before being allowed another credit.`
        );
        return;
      }
    }

    const normalizedMpesaCode = mpesaCode.trim().toUpperCase();
    if (paymentMethod === 'MPESA') {
      if (!/^[A-Z0-9]{10}$/.test(normalizedMpesaCode)) {
        Alert.alert(
          'Valid M-Pesa Code Required',
          'Please enter or extract the 10-character M-Pesa confirmation code (e.g. TJ12AB34CD) from the Send Money / Pochi la Biashara SMS.'
        );
        return;
      }
    }

    const resolvedBuyerName =
      paymentMethod === 'CASH'
        ? buyerName.trim() || `CUST-${Date.now().toString(36).toUpperCase().slice(-6)}`
        : buyerName.trim() || undefined;

    setIsSubmittingSale(true);
    try {
      const res = await recordSale({
        grade: selectedGrade,
        quantityNets: quantity,
        negotiatedUnitPrice: numericPrice,
        paymentMethod,
        buyerName: resolvedBuyerName,
        buyerPhone: buyerPhone.trim() || undefined,
        buyerNationalId: buyerNationalId.trim() || undefined,
        mpesaReceiptCode: normalizedMpesaCode || undefined,
        buyerConsentConfirmed: paymentMethod === 'CREDIT' && creditAuthMode === 'SMS' && buyerAgreed,
        guarantorAccepted: paymentMethod === 'CREDIT' && creditAuthMode === 'GUARANTOR' ? guarantorConsentChecked : true,
      });

      if (res.success) {
      const gradeText = selectedGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2';
      const cleanBuyerPhone = buyerPhone.trim();
      const canAutoSendReceipt =
        Platform.OS === 'android' &&
        simSmsGatewayEnabled &&
        cleanBuyerPhone.replace(/\D/g, '').length >= 9 &&
        (paymentMethod === 'MPESA' || paymentMethod === 'CASH');

      if (canAutoSendReceipt) {
        const thankYouSms = buildThankYouReceiptSms({
          buyerName: buyerName.trim() || undefined,
          itemDesc: `${quantity} nets of ${gradeText}`,
          amountKsh: totalAmount,
          paymentMethod,
          mpesaCode: normalizedMpesaCode || undefined,
        });
        void sendDirectSimSms(normalizeKenyaE164(cleanBuyerPhone), thankYouSms, selectedSimSubId)
          .then(() => incrementSimSmsSent())
          .catch(() => undefined);
      }

      if (paymentMethod === 'MPESA') {
        const customerName = buyerName.trim() || 'Customer';
        const confirmationSms = buildThankYouReceiptSms({
          buyerName: customerName,
          itemDesc: `${quantity} nets of ${gradeText}`,
          amountKsh: totalAmount,
          paymentMethod: 'M-Pesa',
          mpesaCode: normalizedMpesaCode,
        });

        Alert.alert(
          '✅ M-Pesa Payment Received',
          `Funds credited directly to Master Account.\nTotal: Ksh ${totalAmount.toLocaleString()}\n\n📲 Official Thank-You Receipt ${canAutoSendReceipt ? 'sent via SIM' : 'ready'} (${buyerPhone || 'Customer'}):\n"${confirmationSms}"`,
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
      setMpesaCode('');
      setAutoDetectedNotice(null);
      setBuyerNationalId('');
      setMpesaCode('');
      setSmsSent(false);
      setBuyerAgreed(false);
      setGuarantorConsentChecked(false);
    } else {
      Alert.alert('Sale Error', res.message);
    }
    } finally {
      setIsSubmittingSale(false);
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
            <Text style={[styles.headerTitle, isDarkMode && { color: '#7DD3FC' }]}>RECORD SALE</Text>
          </View>
          <Text style={styles.sellerRoleTag}>
            {role === 'MERCHANT' ? 'Master Direct' : 'Seller Mode'}
          </Text>
        </View>

        {/* Grade Selector (Grouped Sliding Pill Switch) */}
        <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>SELECT GRADE</Text>
        <View
          style={[styles.gradeSwitchTrack, isDarkMode && styles.gradeSwitchTrackDark]}
          onLayout={(e) => setGradeSwitchWidth(e.nativeEvent.layout.width)}
        >
          {gradeSwitchWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gradeSwitchActivePill,
                {
                  width: (gradeSwitchWidth - 10) / 2,
                  backgroundColor: selectedGrade === 'GRADE_1' ? '#0891B2' : '#D97706',
                  transform: [
                    {
                      translateX: gradeSwitchAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (gradeSwitchWidth - 10) / 2 + 4],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <TouchableOpacity
            style={styles.gradeSwitchBtn}
            onPress={() => handleGradeSelect('GRADE_1')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.gradeButtonTitle,
                isDarkMode && { color: '#CFE9EC' },
                selectedGrade === 'GRADE_1' && styles.textWhite,
              ]}
              numberOfLines={1}
            >
              Grade 1 ({getBatchPriceForGrade('GRADE_1').toLocaleString()})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gradeSwitchBtn}
            onPress={() => handleGradeSelect('GRADE_2')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.gradeButtonTitle,
                isDarkMode && { color: '#CFE9EC' },
                selectedGrade === 'GRADE_2' && styles.textWhite,
              ]}
              numberOfLines={1}
            >
              Grade 2 ({getBatchPriceForGrade('GRADE_2').toLocaleString()})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quantity (Nets / Sacks) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>CHOOSE NUMBER OF NETS</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#7DD3FC' : '#0891B2' }}>
            {isSeller 
              ? `Assigned: ${availableStock} / ${totalStockForGrade} nets` 
              : `Stock Balance: ${availableStock} nets`}
          </Text>
        </View>
        <View style={styles.quantityRow}>
          <TouchableOpacity 
            style={styles.qtyAdjustBtn} 
            onPress={() => adjustQuantity(-1)}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={22} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
          </TouchableOpacity>

          <View style={[styles.qtyDisplayBox, isDarkMode && styles.qtyDisplayBoxDark]}>
            <Text style={[styles.qtyDisplayText, isDarkMode && { color: '#F0FDFA' }]}>{quantity}</Text>
            <Text style={[styles.qtyDisplayUnit, isDarkMode && { color: '#7DD3FC' }]}>NETS</Text>
          </View>

          <TouchableOpacity 
            style={styles.qtyAdjustBtn} 
            onPress={() => adjustQuantity(1)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
          </TouchableOpacity>

          {/* Quick preset buttons */}
          <View style={styles.presetsRow}>
            {[5, 10, 20].map(val => (
              <TouchableOpacity 
                key={val} 
                style={[
                  styles.presetPill, 
                  availableStock > 0 && val > availableStock && { opacity: 0.45 }
                ]} 
                activeOpacity={0.7}
                onPress={() => {
                  if (availableStock > 0 && val > availableStock) {
                    setQuantity(availableStock);
                  } else {
                    setQuantity(val);
                  }
                }}
              >
                <Text style={[styles.presetPillText, isDarkMode && { color: '#7DD3FC' }]}>+{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Dynamic Negotiated Price */}
        <View style={styles.priceSection}>
          <View style={styles.priceHeaderRow}>
            <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>PRICE PER NET</Text>
          </View>

          <View style={styles.priceInputRow}>
            <View style={[styles.priceDisplayBox, isDarkMode && styles.priceDisplayBoxDark]}>
              <Text style={[styles.currencyPrefixText, isDarkMode && { color: '#7DD3FC' }]}>KSH</Text>
              <TextInput
                style={[styles.priceInput, isDarkMode && { color: '#F0FDFA' }]}
                keyboardType="numeric"
                value={unitPrice}
                onChangeText={setUnitPrice}
                placeholder="e.g. 1300"
                placeholderTextColor={isDarkMode ? '#B4D6D9' : THEME.colors.textMuted}
              />
            </View>
            {/* Quick bargain adjust buttons */}
            <TouchableOpacity style={styles.bargainChip} onPress={() => adjustPrice(-50)} activeOpacity={0.7}>
              <Text style={[styles.bargainChipText, isDarkMode && { color: '#7DD3FC' }]}>-50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bargainChip} onPress={() => adjustPrice(+50)} activeOpacity={0.7}>
              <Text style={[styles.bargainChipText, isDarkMode && { color: '#7DD3FC' }]}>+50</Text>
            </TouchableOpacity>
          </View>

          {/* Minimum Purchase Floor Warning */}
          {numericPrice > 0 && numericPrice < activeMinFloor && (
            <View style={styles.masterPriceIndicatorRow}>
              <Text style={styles.floorWarningText}>⚠️ Cannot sell below Master's minimum price of Ksh {activeMinFloor.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Live Calculation Banner */}
        <View style={[styles.totalBanner, isDarkMode && styles.totalBannerDark]}>
          <Text style={[styles.totalLabel, isDarkMode && { color: '#CFE9EC' }]}>TOTAL SALE VALUE</Text>
          <Text style={[styles.totalValue, isDarkMode && { color: '#7DD3FC' }]}>Ksh {totalAmount.toLocaleString()}</Text>
        </View>

        {/* Payment Method Selector */}
        <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>PAYMENT METHOD</Text>
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

        {/* Customer Name for Cash Sales (auto-assigns unique ID if blank) */}
        {paymentMethod === 'CASH' && (
          <View style={styles.auxFields}>
            <TextInput
              style={[styles.auxInput, isDarkMode && styles.auxInputDark]}
              placeholder="Customer Name (leave blank for auto Customer ID)"
              value={buyerName}
              onChangeText={setBuyerName}
              placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
            />
          </View>
        )}

        {/* Additional Customer Fields for M-Pesa (Send Money / Pochi la Biashara) */}
        {paymentMethod === 'MPESA' && (
          <View style={styles.auxFields}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[styles.creditSubLabel, { marginBottom: 0 }, isDarkMode && { color: '#CFE9EC' }]}>
                M-PESA (SEND MONEY / POCHI LA BIASHARA)
              </Text>
              <TouchableOpacity
                onPress={handleRequestSmsCapture}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons
                  name={smsPermissionGranted ? 'radio-button-on' : 'chatbox-ellipses-outline'}
                  size={14}
                  color={smsPermissionGranted ? '#10B981' : (isDarkMode ? '#5EEAD4' : '#0891B2')}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: smsPermissionGranted ? '#10B981' : (isDarkMode ? '#5EEAD4' : '#0891B2'),
                  }}
                >
                  {smsPermissionGranted ? 'Listening for SMS' : 'Auto-Detect SMS'}
                </Text>
              </TouchableOpacity>
            </View>
            {autoDetectedNotice && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDarkMode ? '#1B4F55' : '#ECFDF5',
                  borderColor: '#10B981',
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginBottom: 6,
                }}
              >
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#6EE7B7' : '#065F46' }}>
                  {autoDetectedNotice}
                </Text>
              </View>
            )}
            <TextInput
              style={[styles.auxInput, { marginBottom: 6 }, isDarkMode && styles.auxInputDark]}
              placeholder="Paste or type M-Pesa Code (e.g. TJ12AB34CD)"
              value={mpesaCode}
              onChangeText={(t) => setMpesaCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput
                style={[styles.auxInput, { flex: 1 }, isDarkMode && styles.auxInputDark]}
                placeholder="Customer Name"
                value={buyerName}
                onChangeText={setBuyerName}
                placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
              />
              <TextInput
                style={[styles.auxInput, { flex: 1 }, isDarkMode && styles.auxInputDark]}
                placeholder="Phone (for STK)"
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                keyboardType="phone-pad"
                placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
              />
            </View>
            <TouchableOpacity
              onPress={handleSendStkPush}
              disabled={stkState.status === 'SENDING' || stkState.status === 'WAITING'}
              activeOpacity={0.85}
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: stkState.status === 'WAITING' ? '#0F766E' : '#10B981',
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                opacity: stkState.status === 'SENDING' ? 0.7 : 1,
              }}
            >
              {stkState.status === 'SENDING' || stkState.status === 'WAITING' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>
                {stkState.status === 'SENDING'
                  ? 'SENDING M-PESA PROMPT...'
                  : stkState.status === 'WAITING'
                    ? 'WAITING FOR CUSTOMER PIN...'
                    : 'SEND M-PESA STK PROMPT'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSendPochiSms}
              disabled={sendingPochiSms}
              activeOpacity={0.85}
              style={{
                marginTop: 6,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: '#0284C7',
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                opacity: sendingPochiSms ? 0.7 : 1,
              }}
            >
              {sendingPochiSms ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>
                {sendingPochiSms
                  ? 'SENDING POCHI DETAILS...'
                  : `SEND POCHI DETAILS SMS (${pochiPhoneNumber || '0115148000'})`}
              </Text>
            </TouchableOpacity>
            {stkState.status !== 'IDLE' && stkState.message && (
              <View
                style={{
                  marginTop: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor:
                    stkState.status === 'FAILED'
                      ? (isDarkMode ? '#3B181C' : '#FEF2F2')
                      : (isDarkMode ? '#1B4F55' : '#ECFDF5'),
                  borderColor: stkState.status === 'FAILED' ? '#EF4444' : '#10B981',
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Ionicons
                  name={
                    stkState.status === 'COMPLETE'
                      ? 'checkmark-circle'
                      : stkState.status === 'FAILED'
                        ? 'alert-circle'
                        : 'time-outline'
                  }
                  size={14}
                  color={stkState.status === 'FAILED' ? '#EF4444' : '#10B981'}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: '700',
                    color:
                      stkState.status === 'FAILED'
                        ? (isDarkMode ? '#FCA5A5' : '#991B1B')
                        : (isDarkMode ? '#A7F3D0' : '#065F46'),
                  }}
                >
                  {stkState.message}
                </Text>
              </View>
            )}
          </View>
        )}

        {paymentMethod === 'CREDIT' && (
          <View style={styles.auxFields}>
            <Text style={[styles.creditSubLabel, isDarkMode && { color: '#CFE9EC' }]}>
              DEBTOR CONTACT INFORMATION
            </Text>
            <TextInput
              style={[styles.auxInput, isDarkMode && styles.auxInputDark]}
              placeholder="Customer Name (e.g. Mama Njoroge / Kariokor Hotel)"
              value={buyerName}
              onChangeText={setBuyerName}
              placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
            />
            <TextInput
              style={[styles.auxInput, { marginTop: 6 }, isDarkMode && styles.auxInputDark]}
              placeholder="Customer Phone (e.g. 0712345678)"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
              placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
            />
            <TextInput
              style={[styles.auxInput, { marginTop: 6 }, isDarkMode && styles.auxInputDark]}
              placeholder="Debtor Kenyan National ID (e.g. 28394812)"
              value={buyerNationalId}
              onChangeText={setBuyerNationalId}
              keyboardType="numeric"
              maxLength={8}
              placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
            />

            {/* Credit Liability Verification Box */}
            <View style={[styles.creditAuthBox, isDarkMode && styles.creditAuthBoxDark]}>
              <View style={styles.creditAuthHeaderRow}>
                <MaterialCommunityIcons 
                  name={isCreditAuthorized ? "shield-check" : "shield-alert"} 
                  size={18} 
                  color={isCreditAuthorized ? "#10B981" : "#F59E0B"} 
                />
                <Text style={[styles.creditAuthTitle, isDarkMode && { color: '#F0FDFA' }]}>
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

              <Text style={[styles.creditAuthExplanation, isDarkMode && { color: '#CFE9EC' }]}>
                To record this credit sale under Kenya DPA, either the debtor must acknowledge liability via SMS agreement, or an authorized guarantor must sign off.
              </Text>

              {/* Mode Switcher */}
              <View style={[styles.creditAuthTabs, isDarkMode && { backgroundColor: '#1B4F55' }]}>
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
                    color={creditAuthMode === 'SMS' ? (isDarkMode ? '#5EEAD4' : '#0891B2') : (isDarkMode ? '#CFE9EC' : '#64748B')} 
                  />
                  <Text style={[
                    styles.creditAuthTabText,
                    creditAuthMode === 'SMS' && styles.creditAuthTabTextActive,
                    isDarkMode && { color: creditAuthMode === 'SMS' ? '#5EEAD4' : '#CFE9EC' }
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
                    color={creditAuthMode === 'GUARANTOR' ? (isDarkMode ? '#5EEAD4' : '#0891B2') : (isDarkMode ? '#CFE9EC' : '#64748B')} 
                  />
                  <Text style={[
                    styles.creditAuthTabText,
                    creditAuthMode === 'GUARANTOR' && styles.creditAuthTabTextActive,
                    isDarkMode && { color: creditAuthMode === 'GUARANTOR' ? '#5EEAD4' : '#CFE9EC' }
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
                      <View style={[styles.smsStatusCard, isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' }]}>
                        <View style={styles.smsSentRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={[styles.smsSentText, isDarkMode && { color: '#F0FDFA' }]}>
                            Agreement SMS sent to {buyerPhone}
                          </Text>
                        </View>
                        <Text style={[styles.smsAwaitingText, isDarkMode && { color: '#CFE9EC' }]}>
                          Debtor was asked to reply "YES" to confirm debt of Ksh {totalAmount.toLocaleString()} from Truck {currentBatch.truckPlate}.
                        </Text>
                      </View>

                      {!buyerAgreed ? (
                        <TouchableOpacity
                          style={[styles.simulateReplyBtn, isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' }]}
                          onPress={handleSimulateBuyerConsent}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="cellphone-message" size={16} color={isDarkMode ? '#5EEAD4' : '#0891B2'} />
                          <Text style={[styles.simulateReplyBtnText, isDarkMode && { color: '#5EEAD4' }]}>
                            Simulate Debtor Reply "YES" (Accept Liability)
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.verifiedConsentCard, isDarkMode && { backgroundColor: '#064E3B', borderColor: '#10B981' }]}>
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
                    <Text style={[styles.guarantorInstruction, isDarkMode && { color: '#CFE9EC' }]}>
                      Seller or Master pledges personal liability for this debt:
                    </Text>
                    <TouchableOpacity
                      style={[styles.autofillBtn, isDarkMode && { backgroundColor: '#1B4F55', borderWidth: 1, borderColor: 'rgba(122, 181, 188, 0.45)' }]}
                      onPress={handleAutofillSelfGuarantor}
                    >
                      <Ionicons name="person" size={11} color={isDarkMode ? '#5EEAD4' : '#0891B2'} />
                      <Text style={[styles.autofillBtnText, isDarkMode && { color: '#5EEAD4' }]}>Use My Details</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.auxInput, isDarkMode && styles.auxInputDark]}
                    placeholder="Guarantor Full Name"
                    value={guarantorName}
                    onChangeText={setGuarantorName}
                    placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
                  />
                  <TextInput
                    style={[styles.auxInput, { marginTop: 6 }, isDarkMode && styles.auxInputDark]}
                    placeholder="Guarantor Phone Number"
                    value={guarantorPhone}
                    onChangeText={setGuarantorPhone}
                    keyboardType="phone-pad"
                    placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
                  />
                  <TextInput
                    style={[styles.auxInput, { marginTop: 6 }, isDarkMode && styles.auxInputDark]}
                    placeholder="Guarantor Kenyan National ID (e.g. 24918230)"
                    value={guarantorNationalId}
                    onChangeText={setGuarantorNationalId}
                    keyboardType="numeric"
                    maxLength={8}
                    placeholderTextColor={isDarkMode ? '#9AC7CC' : THEME.colors.textMuted}
                  />

                  {/* Legal Guarantee Checkbox */}
                  <TouchableOpacity
                    style={[
                      styles.guarantorCheckboxRow, 
                      isDarkMode && { backgroundColor: '#1B4F55', borderColor: 'rgba(122, 181, 188, 0.45)' },
                      guarantorConsentChecked && (isDarkMode ? { backgroundColor: '#064E3B', borderColor: '#10B981' } : styles.guarantorCheckboxRowActive)
                    ]}
                    onPress={() => setGuarantorConsentChecked(prev => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={guarantorConsentChecked ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={guarantorConsentChecked ? "#10B981" : (isDarkMode ? "#9AC7CC" : "#64748B")} 
                    />
                    <Text style={[
                      styles.guarantorCheckboxLabel,
                      isDarkMode && { color: '#F0FDFA' },
                      guarantorConsentChecked && { fontWeight: '700' }
                    ]}>
                      I, <Text style={styles.boldText}>{guarantorName || 'Guarantor'}</Text> (ID: {guarantorNationalId || 'N/A'}, {role === 'MERCHANT' ? 'Master' : 'Seller'}), formally agree to be personally & financially liable for Ksh {totalAmount.toLocaleString()} if {buyerName || 'the debtor'} (ID: {buyerNationalId || 'N/A'}) defaults.
                    </Text>
                  </TouchableOpacity>

                  {guarantorConsentChecked && guarantorName.trim().length > 0 && guarantorPhone.trim().length > 0 && (
                    <View style={[styles.verifiedConsentCard, isDarkMode && { backgroundColor: '#064E3B', borderColor: '#10B981' }]}>
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
    borderRadius: 12,
    padding: 14,
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
  gradeSwitchTrack: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginBottom: THEME.spacing.md,
  },
  gradeSwitchTrackDark: {
    backgroundColor: '#1B4F55',
  },
  gradeSwitchActivePill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 8,
  },
  gradeSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
    width: 38,
    height: 44,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyDisplayBox: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  qtyDisplayBoxDark: {
    backgroundColor: '#1B4F55',
  },
  qtyDisplayText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  qtyDisplayUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  presetPill: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  presetPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
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
  priceDisplayBox: {
    flex: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceDisplayBoxDark: {
    backgroundColor: '#1B4F55',
  },
  currencyPrefixText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0891B2',
  },
  priceInput: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  bargainChip: {
    height: 44,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bargainChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
  },
  totalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: THEME.spacing.md,
  },
  totalBannerDark: {
    backgroundColor: '#1B4F55',
  },
  totalLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0891B2',
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
    borderRadius: 10,
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  auxInputDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    color: '#F0FDFA',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creditAuthBoxDark: {
    backgroundColor: '#143D42',
    borderColor: 'rgba(122, 181, 188, 0.45)',
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
    borderRadius: 10,
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
    borderRadius: 8,
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
    backgroundColor: '#256A71',
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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

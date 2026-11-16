// ============================================================================
// The Gem: 14:00 Close of Business (COB) Daily Closure Receipt
// Flowing thermal receipt formatted for simplistic analysis and master approval.
// Live stream receipt updating in real time as sales and deductions stream in.
// Displays exact line-by-line reconciliation:
// Date, Stock Opening, Stock Closing, Difference (Nets sold),
// Sales (G1 & G2 @ price), Credit (person details), Total Sales After Credit,
// Expenses (NCC, Watchman, Sweepers, Labour with interactive live approvals),
// Balance After Expenses, and Remittance Breakdown.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { DailyReconciliation } from '../../types';
import { buildDayClosureReceiptSms } from '../../utils/smsTemplates';
import { normalizeKenyaE164, sendDirectSimSms } from '../../hooks/useSimSmsGateway';

interface DailyClosureReceiptProps {
  reconciliation?: DailyReconciliation;
  isDarkMode?: boolean;
}

export const DailyClosureReceipt: React.FC<DailyClosureReceiptProps> = ({
  reconciliation,
  isDarkMode = false,
}) => {
  const {
    reconciliations,
    storeName,
    currentUserName,
    masterName,
    role,
    currentBatch,
    sales,
    expenses,
    casualLaborers,
    customerCredits,
    performCobReconciliation,
    approveDailyReconciliation,
    toggleNccCessPayment,
    toggleExpensePaid,
    masterPhoneNumber,
    currentUserPhone,
    selectedSimSubId,
    incrementSimSmsSent,
  } = useAppStore();

  const effectiveMaster = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';
  const monospaceFont = Platform.OS === 'ios' ? 'Courier' : 'monospace';

  // Toggle between Live Streaming Today's Receipt and Past Sealed Reconciliations
  const [selectedView, setSelectedView] = useState<'LIVE' | string>(
    reconciliation ? reconciliation.id : 'LIVE'
  );
  const [isSealing, setIsSealing] = useState(false);
  const [locallySealed, setLocallySealed] = useState(false);
  const [sendingClosureSms, setSendingClosureSms] = useState(false);

  const isViewingLive = selectedView === 'LIVE';
  const liveDayNumber = currentBatch?.dayNumber || 1;

  // Only CLOSED days (strictly before today's live day) appear as history tabs.
  // Today's day is always represented by "Today (Live)", and duplicates per day are collapsed.
  const batchReconciliations = useMemo(() => {
    const filtered = currentBatch
      ? reconciliations.filter((r) => r.batchId === currentBatch.id)
      : reconciliations;
    const closedOnly = filtered.filter(
      (r) => typeof r.dayNumber !== 'number' || r.dayNumber < liveDayNumber
    );
    const byDay = new Map<string, DailyReconciliation>();
    for (const r of closedOnly) {
      const key = typeof r.dayNumber === 'number' ? `d${r.dayNumber}` : `id${r.id}`;
      const prev = byDay.get(key);
      if (!prev || (r.cobTimestamp ?? '') > (prev.cobTimestamp ?? '')) byDay.set(key, r);
    }
    return [...byDay.values()].sort(
      (a, b) => ((a.dayNumber ?? 0) - (b.dayNumber ?? 0)) || a.date.localeCompare(b.date)
    );
  }, [reconciliations, currentBatch, liveDayNumber]);

  const latestClosedRec = batchReconciliations.length > 0
    ? batchReconciliations[batchReconciliations.length - 1]
    : undefined;

  const activeRec: DailyReconciliation | undefined =
    !isViewingLive
      ? batchReconciliations.find((r) => r.id === selectedView) || reconciliations.find((r) => r.id === selectedView) || reconciliation
      : undefined;

  // Carry forward previous day's closing stock as today's opening stock when viewing live
  const openingG1 = isViewingLive
    ? (latestClosedRec ? latestClosedRec.physicalCountGrade1 : (currentBatch?.initialGrade1Nets ?? 0))
    : (activeRec?.openingStockGrade1 ?? 0);
  const openingG2 = isViewingLive
    ? (latestClosedRec ? latestClosedRec.physicalCountGrade2 : (currentBatch?.initialGrade2Nets ?? 0))
    : (activeRec?.openingStockGrade2 ?? 0);

  const closingG1 = isViewingLive
    ? (currentBatch?.remainingGrade1Nets ?? 0)
    : (activeRec?.physicalCountGrade1 ?? 0);
  const closingG2 = isViewingLive
    ? (currentBatch?.remainingGrade2Nets ?? 0)
    : (activeRec?.physicalCountGrade2 ?? 0);

  const liveBatchSales = useMemo(() => {
    const base = currentBatch ? sales.filter((s) => s.batchId === currentBatch.id) : sales;
    if (!latestClosedRec) return base;
    return base.filter((s) => s.timestamp > latestClosedRec.cobTimestamp);
  }, [sales, currentBatch, latestClosedRec]);

  const soldG1Live = useMemo(() => {
    return liveBatchSales
      .filter((s) => s.grade === 'GRADE_1')
      .reduce((sum, s) => sum + s.quantityNets, 0);
  }, [liveBatchSales]);

  const soldG2Live = useMemo(() => {
    return liveBatchSales
      .filter((s) => s.grade === 'GRADE_2')
      .reduce((sum, s) => sum + s.quantityNets, 0);
  }, [liveBatchSales]);

  const soldG1 = isViewingLive
    ? (soldG1Live > 0 ? soldG1Live : Math.max(0, openingG1 - closingG1))
    : (activeRec?.soldGrade1Nets ?? Math.max(0, openingG1 - closingG1));

  const soldG2 = isViewingLive
    ? (soldG2Live > 0 ? soldG2Live : Math.max(0, openingG2 - closingG2))
    : (activeRec?.soldGrade2Nets ?? Math.max(0, openingG2 - closingG2));

  // Target Selling Prices
  const setPriceG1 = currentBatch?.pricePerBagGrade1 ?? activeRec?.expectedPriceGrade1 ?? 0;
  const setPriceG2 = currentBatch?.pricePerBagGrade2 ?? activeRec?.expectedPriceGrade2 ?? 0;

  const salesG1Live = useMemo(() => {
    const list = liveBatchSales.filter((s) => s.grade === 'GRADE_1');
    return list.length > 0 ? list.reduce((sum, s) => sum + s.totalAmount, 0) : soldG1 * setPriceG1;
  }, [liveBatchSales, soldG1, setPriceG1]);

  const salesG2Live = useMemo(() => {
    const list = liveBatchSales.filter((s) => s.grade === 'GRADE_2');
    return list.length > 0 ? list.reduce((sum, s) => sum + s.totalAmount, 0) : soldG2 * setPriceG2;
  }, [liveBatchSales, soldG2, setPriceG2]);

  const salesG1 = isViewingLive ? salesG1Live : (activeRec?.expectedGrossRevenueGrade1 ?? soldG1 * setPriceG1);
  const salesG2 = isViewingLive ? salesG2Live : (activeRec?.expectedGrossRevenueGrade2 ?? soldG2 * setPriceG2);
  const grossSalesSum = salesG1 + salesG2;

  // Credit items attributed to this session
  const creditEntries = useMemo(() => {
    if (isViewingLive) {
      // Gather live credit sales recorded today
      const liveCredits = sales.filter((s) => s.paymentMethod === 'CREDIT');
      if (liveCredits.length > 0) {
        return liveCredits.map((s) => ({
          grade: (s.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2') as 'Grade 1' | 'Grade 2',
          buyerName: s.buyerName || 'Buyer on Credit',
          nets: s.quantityNets,
          unitPrice: s.negotiatedUnitPrice,
          amount: s.totalAmount,
        }));
      }

      // If customerCredits has entries
      const list: {
        grade: 'Grade 1' | 'Grade 2';
        buyerName: string;
        nets: number;
        unitPrice: number;
        amount: number;
      }[] = [];

      customerCredits.forEach((cust) => {
        cust.records.forEach((rec) => {
          list.push({
            grade: rec.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2',
            buyerName: cust.customerName.replace(/ Supplies| Limited| Enterprise/g, ''),
            nets: rec.quantityNets,
            unitPrice: rec.quantityNets > 0 ? Math.round(rec.totalOwed / rec.quantityNets) : (rec.grade === 'GRADE_1' ? setPriceG1 : setPriceG2),
            amount: rec.totalOwed,
          });
        });
      });

      return list;
    }

    // Historical
    const list: {
      grade: 'Grade 1' | 'Grade 2';
      buyerName: string;
      nets: number;
      unitPrice: number;
      amount: number;
    }[] = [];

    customerCredits.forEach((cust) => {
      cust.records.forEach((rec) => {
        if (!activeRec || rec.batchId === activeRec.batchId || rec.dateIssued === activeRec.date) {
          list.push({
            grade: rec.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2',
            buyerName: cust.customerName.replace(/ Supplies| Limited| Enterprise/g, ''),
            nets: rec.quantityNets,
            unitPrice: rec.quantityNets > 0 ? Math.round(rec.totalOwed / rec.quantityNets) : (rec.grade === 'GRADE_1' ? setPriceG1 : setPriceG2),
            amount: rec.totalOwed,
          });
        }
      });
    });

    return list;
  }, [isViewingLive, sales, customerCredits, activeRec, setPriceG1, setPriceG2]);

  const totalCreditSum = creditEntries.reduce((sum, c) => sum + c.amount, 0);
  const salesAfterCredit = grossSalesSum - totalCreditSum;

  // Live Expenses & Deductions Tracking
  const nccNets = currentBatch?.nccDeclaredNets ?? openingG1;
  const nccCess = currentBatch?.nccCessPaid ?? (nccNets * 16);
  const isNccPaid = currentBatch?.isNccCessPaid ?? false;

  const watchmanExpense = expenses.find((e) => e.category === 'WATCHMAN');
  const watchmanFee = watchmanExpense?.amount ?? 0;
  const isWatchmanPaid = watchmanExpense?.isPaid ?? false;

  const sweeperExpense = expenses.find((e) => e.category === 'CLEANER' || (e.category as string) === 'SWEEPING_AND_SANITATION');
  const sweepersFee = sweeperExpense?.amount ?? 0;
  const isSweepersPaid = sweeperExpense?.isPaid ?? false;

  const labor1 = casualLaborers.find((l) => l.workerName.includes('1') || l.workerName.toLowerCase().includes('person 1'))?.agreedWage ?? 0;
  const labor2 = casualLaborers.find((l) => l.workerName.includes('Assistant') || l.workerName.toLowerCase().includes('assistant'))?.agreedWage ?? 0;
  const isLaborPaid = true; // casual laborers on-site daily wage

  // Total deductions: Calculated based on approved/collected deductions
  const totalExpensesSum = (isNccPaid ? nccCess : 0) + (isWatchmanPaid ? watchmanFee : 0) + (isSweepersPaid ? sweepersFee : 0) + labor1 + labor2;

  // Balance After expenses
  const balanceAfterExpenses = salesAfterCredit - totalExpensesSum;

  // Remittance Breakdown (Cash drawer + M-Pesa till)
  const liveCashSales = useMemo(() => {
    return liveBatchSales
      .filter((s) => s.paymentMethod === 'CASH')
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [liveBatchSales]);

  const liveMpesaSales = useMemo(() => {
    return liveBatchSales
      .filter((s) => s.paymentMethod === 'MPESA')
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [liveBatchSales]);

  const cashDeposited = isViewingLive
    ? Math.max(0, liveCashSales - totalExpensesSum)
    : (activeRec?.actualCashInHand ?? 0);

  const mpesaDirect = isViewingLive
    ? liveMpesaSales
    : (activeRec?.mpesaSalesToday ?? 0);

  const totalRemitted = cashDeposited + mpesaDirect;
  const isBalanced = isViewingLive ? true : totalRemitted === balanceAfterExpenses;
  const isApproved = Boolean(
    (!isViewingLive && activeRec?.masterApprovalStatus === 'APPROVED') || locallySealed
  );

  const todayDisplayDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const currentDateText = isViewingLive
    ? todayDisplayDate
    : (activeRec?.date || todayDisplayDate);

  const handleApprove = async () => {
    if (isSealing) return;
    setIsSealing(true);
    try {
      if (activeRec) {
        await approveDailyReconciliation(activeRec.id);
        setSelectedView(activeRec.id);
        Alert.alert(
          '✅ Daily Closure Approved',
          `Master sign-off confirmed! Cash of Ksh ${cashDeposited.toLocaleString()} and M-Pesa direct of Ksh ${mpesaDirect.toLocaleString()} (Total Ksh ${totalRemitted.toLocaleString()}) verified.`
        );
      } else if (currentBatch) {
        const createdRec = await performCobReconciliation({
          physicalCountGrade1: closingG1,
          physicalCountGrade2: closingG2,
          actualCashInHand: cashDeposited,
          notes: 'Master Direct Seal & Approval',
        });
        if (createdRec) {
          if (createdRec.masterApprovalStatus !== 'APPROVED') {
            await approveDailyReconciliation(createdRec.id);
          }
          setSelectedView(createdRec.id);
        } else {
          setLocallySealed(true);
        }
        Alert.alert(
          '✅ Daily Closure Sealed & Approved',
          `Sealed receipt recorded for ${currentDateText}!\nCash In Hand: Ksh ${cashDeposited.toLocaleString()}\nM-Pesa Direct: Ksh ${mpesaDirect.toLocaleString()}\nTotal Remitted: Ksh ${totalRemitted.toLocaleString()}`
        );
      } else {
        setLocallySealed(true);
        Alert.alert(
          '✅ Daily Closure Sealed & Approved',
          `Master audit approved for ${currentDateText}!\nCash In Hand: Ksh ${cashDeposited.toLocaleString()}\nM-Pesa Direct: Ksh ${mpesaDirect.toLocaleString()}\nTotal Remitted: Ksh ${totalRemitted.toLocaleString()}`
        );
      }
    } catch (err: any) {
      Alert.alert('Approval Failed', err?.message || 'Unable to seal daily closure. Please try again.');
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <View style={styles.outerWrapper}>
      {/* Historical Closure Selector (Today Live + Past Sealed Days) */}
      {batchReconciliations.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historySelectorRow}>
          <TouchableOpacity
            style={[styles.historyTab, isViewingLive && styles.historyTabActive]}
            onPress={() => setSelectedView('LIVE')}
          >
            <Text style={[styles.historyTabText, isViewingLive && styles.historyTabTextActive]}>
              Today (Live)
            </Text>
          </TouchableOpacity>
          {batchReconciliations.map((rec, idx) => {
            const isSelected = !isViewingLive && rec.id === activeRec?.id;
            return (
              <TouchableOpacity
                key={rec.id}
                style={[styles.historyTab, isSelected && styles.historyTabActive]}
                onPress={() => setSelectedView(isSelected ? 'LIVE' : rec.id)}
              >
                <Text style={[styles.historyTabText, isSelected && styles.historyTabTextActive]}>
                  Day {rec.dayNumber || idx + 1} ({rec.date})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Main Flowing Thermal Receipt Paper */}
      <View style={[styles.receiptPaper, isDarkMode && styles.receiptPaperDark]}>
        {/* Serrated Top Edge Effect */}
        <View style={styles.serratedEdge}>
          <Text style={[styles.serratedText, isDarkMode && { color: '#475569' }]}>
            - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          </Text>
        </View>

        {/* Header Block */}
        <View style={styles.headerBlock}>
          <View style={styles.topActionRow}>
            <Text style={[styles.tagPillText, { fontSize: 12, fontWeight: '800', color: isDarkMode ? '#7DD3FC' : '#0891B2' }]}>
              Day {isViewingLive ? (currentBatch?.dayNumber || 1) : (activeRec?.dayNumber || 1)}
            </Text>
          </View>

          <Text style={[styles.storeHeading, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
            {(storeName || 'NKACE ENTERPRISE').toUpperCase()}
          </Text>
          <Text style={[styles.marketSub, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            WAKULIMA WHOLESALE ONION MARKET • NAIROBI
          </Text>
        </View>

        <Text style={[styles.dashedLine, { fontFamily: monospaceFont }, isDarkMode && { color: '#7AB5BC' }]}>
          ----------------------------------------
        </Text>

        {/* 1. Date Block */}
        <View style={styles.receiptLineRow}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>Date: </Text>
          <Text style={[styles.receiptText, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            {currentDateText} {isViewingLive ? '(Live Market Day)' : ''}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 2. Stock: Opening Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>Stock: Opening </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            - Grade 1 : {openingG1} nets
          </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            - Grade 2 : {openingG2} nets
          </Text>
        </View>

        {/* 3. Stock: Closing Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
            Stock: Closing {isViewingLive ? '(Current Bay Remaining)' : ''}
          </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            - Grade 1 : {closingG1} nets
          </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            - Grade 2 : {closingG2} nets
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 4. Difference Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>Difference: </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Grade 1 : ({openingG1} nets - {closingG1} nets)
          </Text>
          <Text style={[styles.receiptTextResult, { fontFamily: monospaceFont }, isDarkMode && { color: '#FDE68A' }]}>
            = {soldG1} nets
          </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Grade 2 : ({openingG2} nets - {closingG2} nets)
          </Text>
          <Text style={[styles.receiptTextResult, { fontFamily: monospaceFont }, isDarkMode && { color: '#FDE68A' }]}>
            = {soldG2} nets
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 5. Sales Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>Sales: </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Grade 1 : {soldG1} nets * {setPriceG1} = <Text style={{ fontWeight: '800', color: isDarkMode ? '#F0FDFA' : '#0F172A' }}>{salesG1.toLocaleString()}</Text>
          </Text>
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Grade 2 : {soldG2} nets * {setPriceG2} = <Text style={{ fontWeight: '800', color: isDarkMode ? '#F0FDFA' : '#0F172A' }}>{salesG2.toLocaleString()}</Text>
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 6. Credit Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>Credit: </Text>
          {creditEntries.length > 0 ? (
            creditEntries.map((cred, idx) => (
              <Text key={idx} style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
                {cred.grade === 'Grade 1' && idx === 0 ? 'Grade 1: ' : idx === 1 && cred.grade === 'Grade 2' ? 'Grade 2: ' : ''}
                {cred.buyerName} {cred.nets} nets * {cred.unitPrice} = {cred.amount.toLocaleString()}
              </Text>
            ))
          ) : (
            <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont, color: isDarkMode ? '#B4D6D9' : '#94A3B8' }]}>
              None (0 nets issued on credit today)
            </Text>
          )}
        </View>

        <View style={styles.spacer} />

        {/* 7. Total Sales After Credit Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
            Total sales after credit: ({salesG1.toLocaleString()} + {salesG2.toLocaleString()}) - ({creditEntries.length > 0 ? creditEntries.map(c => c.amount.toLocaleString()).join(' + ') : '0'})
          </Text>
          <Text style={[styles.receiptTextResultLarge, { fontFamily: monospaceFont, color: isDarkMode ? '#FDE68A' : '#047857' }]}>
            = Ksh {salesAfterCredit.toLocaleString()}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 8. Expenses Block with Live Approval Actions */}
        <View style={styles.receiptBlock}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
              Expenses & Deductions
            </Text>
            {isViewingLive && (
              <Text style={{ fontSize: 10, fontWeight: '700', color: isDarkMode ? '#FDE68A' : '#0891B2' }}>
                Tap to Approve Live
              </Text>
            )}
          </View>

          {/* NCC Cess */}
          <View style={styles.expenseApprovalRow}>
            <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont, flex: 1 }, isDarkMode && { color: '#CFE9EC' }]}>
              NCC : {nccNets} nets = {nccCess.toLocaleString()}
            </Text>
            <TouchableOpacity
              style={[
                styles.deductionStatusChip,
                isNccPaid ? styles.chipPaid : styles.chipPending,
                isDarkMode && {
                  backgroundColor: '#256A71',
                  borderWidth: 0.75,
                  borderColor: isNccPaid ? '#7AB5BC' : '#FDE68A',
                },
              ]}
              onPress={toggleNccCessPayment}
              disabled={!isViewingLive}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isNccPaid ? 'checkmark-circle' : 'time-outline'}
                size={11}
                color={isDarkMode ? (isNccPaid ? '#F0FDFA' : '#FDE68A') : (isNccPaid ? '#059669' : '#D97706')}
              />
              <Text style={[styles.chipText, { color: isDarkMode ? (isNccPaid ? '#F0FDFA' : '#FDE68A') : (isNccPaid ? '#059669' : '#D97706') }]}>
                {isNccPaid ? 'PAID' : 'APPROVE PAID'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Watchman Fee */}
          <View style={styles.expenseApprovalRow}>
            <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont, flex: 1 }, isDarkMode && { color: '#CFE9EC' }]}>
              Watchman: {watchmanFee.toLocaleString()}
            </Text>
            <TouchableOpacity
              style={[
                styles.deductionStatusChip,
                isWatchmanPaid ? styles.chipPaid : styles.chipPending,
                isDarkMode && {
                  backgroundColor: '#256A71',
                  borderWidth: 0.75,
                  borderColor: isWatchmanPaid ? '#7AB5BC' : '#FDE68A',
                },
              ]}
              onPress={() => toggleExpensePaid('WATCHMAN')}
              disabled={!isViewingLive}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isWatchmanPaid ? 'checkmark-circle' : 'time-outline'}
                size={11}
                color={isDarkMode ? (isWatchmanPaid ? '#F0FDFA' : '#FDE68A') : (isWatchmanPaid ? '#059669' : '#D97706')}
              />
              <Text style={[styles.chipText, { color: isDarkMode ? (isWatchmanPaid ? '#F0FDFA' : '#FDE68A') : (isWatchmanPaid ? '#059669' : '#D97706') }]}>
                {isWatchmanPaid ? 'COLLECTED' : 'APPROVE COLLECTED'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sweepers Fee */}
          <View style={styles.expenseApprovalRow}>
            <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont, flex: 1 }, isDarkMode && { color: '#CFE9EC' }]}>
              Sweepers: {sweepersFee.toLocaleString()}
            </Text>
            <TouchableOpacity
              style={[
                styles.deductionStatusChip,
                isSweepersPaid ? styles.chipPaid : styles.chipPending,
                isDarkMode && {
                  backgroundColor: '#256A71',
                  borderWidth: 0.75,
                  borderColor: isSweepersPaid ? '#7AB5BC' : '#FDE68A',
                },
              ]}
              onPress={() => toggleExpensePaid('CLEANER')}
              disabled={!isViewingLive}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSweepersPaid ? 'checkmark-circle' : 'time-outline'}
                size={11}
                color={isDarkMode ? (isSweepersPaid ? '#F0FDFA' : '#FDE68A') : (isSweepersPaid ? '#059669' : '#D97706')}
              />
              <Text style={[styles.chipText, { color: isDarkMode ? (isSweepersPaid ? '#F0FDFA' : '#FDE68A') : (isSweepersPaid ? '#059669' : '#D97706') }]}>
                {isSweepersPaid ? 'COLLECTED' : 'APPROVE COLLECTED'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Labour */}
          <Text style={[styles.receiptTextIndent, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Labour: Sales person 1 = {labor1.toLocaleString()}
          </Text>
          <Text style={[styles.receiptTextIndentExtra, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
            Sales Assistant = {labor2.toLocaleString()}
          </Text>

          <Text style={[styles.receiptTextResult, { fontFamily: monospaceFont, paddingLeft: 0, marginTop: 6 }, isDarkMode && { color: '#FDE68A' }]}>
            Total approved deductions = Ksh {totalExpensesSum.toLocaleString()}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* 9. Balance After Expenses Block */}
        <View style={styles.receiptBlock}>
          <Text style={[styles.receiptTextBold, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
            Balance After expenses = {salesAfterCredit.toLocaleString()} - {totalExpensesSum.toLocaleString()}
          </Text>
          <Text style={[styles.receiptTextResultLarge, { fontFamily: monospaceFont, color: isDarkMode ? '#F0FDFA' : '#0F172A' }]}>
            = Ksh {balanceAfterExpenses.toLocaleString()}
          </Text>
        </View>

        <Text style={[styles.dashedLine, { fontFamily: monospaceFont }, isDarkMode && { color: '#7AB5BC' }]}>
          ========================================
        </Text>

        {/* 10. Remittance / Deposits Block (Master to Approve) */}
        <View style={[styles.remittanceBox, isDarkMode && { backgroundColor: '#256A71', borderColor: '#7AB5BC', borderWidth: 0.75 }]}>
          <View style={styles.receiptLineRow}>
            <Text style={[styles.remitLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
              Cash (deposited to Mpesa / equity)
            </Text>
            <Text style={[styles.remitValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
              = {cashDeposited.toLocaleString()} (master to approve)
            </Text>
          </View>

          <View style={styles.receiptLineRow}>
            <Text style={[styles.remitLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
              Mpesa deposited directly
            </Text>
            <Text style={[styles.remitValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#CFE9EC' }]}>
              = {mpesaDirect.toLocaleString()} (master to approve)
            </Text>
          </View>

          <View style={[styles.totalRemitRow, isDarkMode && { borderTopColor: 'rgba(122, 181, 188, 0.45)' }]}>
            <Text style={[styles.totalRemitText, { fontFamily: monospaceFont }, isDarkMode && { color: '#FDE68A' }]}>
              Total = Ksh {totalRemitted.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.balancedStatusText,
                { fontFamily: monospaceFont, color: isDarkMode ? '#FDE68A' : (isBalanced ? '#059669' : '#DC2626') },
              ]}
            >
              ({isBalanced ? 'when successfully balanced' : `discrepancy: Ksh ${totalRemitted - balanceAfterExpenses}`}).
            </Text>
          </View>
        </View>

        {/* 11. Master Approval Action / Signature */}
        {role === 'MERCHANT' && isViewingLive && !isApproved ? (
          <TouchableOpacity
            style={[
              styles.masterApproveBtn,
              isDarkMode && styles.masterApproveBtnDark,
              isSealing && { opacity: 0.6 },
            ]}
            onPress={handleApprove}
            disabled={isSealing}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-done-circle" size={18} color={isDarkMode ? '#FDE68A' : '#FFFFFF'} />
            <Text style={[styles.masterApproveBtnText, isDarkMode && { color: '#FDE68A' }]}>
              {isSealing ? 'SEALING DAY...' : 'APPROVE & SEAL DAY'}
            </Text>
          </TouchableOpacity>
        ) : isApproved || !isViewingLive ? (
          <View style={[styles.approvalSignBox, isDarkMode && { backgroundColor: '#256A71', borderColor: '#FDE68A', borderWidth: 0.75 }]}>
            <Ionicons name={isViewingLive ? 'shield-checkmark' : 'lock-closed'} size={16} color={isDarkMode ? '#FDE68A' : '#059669'} />
            <Text style={[styles.approvalSignText, { fontFamily: monospaceFont }, isDarkMode && { color: '#FDE68A' }]}>
              {isViewingLive
                ? `MASTER AUDIT SIGNATURE: Approved by ${effectiveMaster} on ${currentDateText}`
                : `CLOSED DAY (READ-ONLY): Day ${activeRec?.dayNumber || ''} sealed on ${currentDateText}`}
            </Text>
          </View>
        ) : (
          <View style={[styles.waitingSignBox, isDarkMode && { backgroundColor: '#256A71', borderColor: '#FDE68A', borderWidth: 0.75 }]}>
            <Ionicons name="time" size={16} color={isDarkMode ? '#FDE68A' : '#D97706'} />
            <Text style={[styles.waitingSignText, { fontFamily: monospaceFont }, isDarkMode && { color: '#FDE68A' }]}>
              QUEUED: Awaiting Master Administrator verification and sign-off.
            </Text>
          </View>
        )}

        {Platform.OS === 'android' && (
          <TouchableOpacity
            disabled={sendingClosureSms}
            activeOpacity={0.85}
            onPress={async () => {
              const target = (masterPhoneNumber || (role === 'MERCHANT' ? currentUserPhone : '')).trim();
              if (target.replace(/\D/g, '').length < 9) {
                Alert.alert(
                  'Master Phone Required',
                  'Go to Profile -> SIM SMS Setup and enter Master\'s Phone Number first.'
                );
                return;
              }
              const smsBody = buildDayClosureReceiptSms({
                sellerName: currentUserName || 'Salesperson',
                storeName: storeName || 'The Gem',
                dateText: currentDateText,
                truckPlate: currentBatch?.truckPlate,
                g1Sold: soldG1,
                g2Sold: soldG2,
                grossSales: grossSalesSum,
                creditTotal: totalCreditSum,
                expensesTotal: totalExpensesSum,
                cashInHand: cashDeposited,
                mpesaDirect,
                totalRemitted,
              });
              setSendingClosureSms(true);
              try {
                const e164 = normalizeKenyaE164(target);
                await sendDirectSimSms(e164, smsBody, selectedSimSubId);
                incrementSimSmsSent();
                Alert.alert(
                  'Day Closure SMS Sent',
                  `Final Day Closure Receipt sent from your phone SIM to Master (${e164}).`
                );
              } catch (err) {
                Alert.alert(
                  'SIM Send Failed',
                  err instanceof Error ? err.message : 'Could not send Day Closure SMS'
                );
              } finally {
                setSendingClosureSms(false);
              }
            }}
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#0284C7',
              borderRadius: 10,
              paddingVertical: 11,
              paddingHorizontal: 14,
              opacity: sendingClosureSms ? 0.65 : 1,
            }}
          >
            <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>
              {sendingClosureSms ? 'SENDING DAY CLOSURE SMS...' : 'SEND DAY CLOSURE SMS TO MASTER'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    marginHorizontal: 14,
    marginBottom: 16,
  },
  historySelectorRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  historyTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  historyTabLive: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  historyTabActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  historyTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  historyTabTextActive: {
    color: '#FFFFFF',
  },
  receiptPaper: {
    backgroundColor: '#FFFDF7',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  receiptPaperDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  serratedEdge: {
    alignItems: 'center',
    overflow: 'hidden',
    height: 12,
  },
  serratedText: {
    color: '#94A3B8',
    fontSize: 10,
    letterSpacing: 2,
  },
  headerBlock: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  topActionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  tagPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0891B2',
  },
  storeHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  marketSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  approvalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
  },
  approvalBannerApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  approvalBannerLive: {
    backgroundColor: '#ECFEFF',
    borderColor: '#A5F3FC',
  },
  approvalBannerPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  approvalStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dashedLine: {
    color: '#CBD5E1',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 6,
    overflow: 'hidden',
  },
  spacer: {
    height: 8,
  },
  receiptBlock: {
    marginVertical: 2,
  },
  receiptLineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  receiptText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  receiptTextBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  receiptTextIndent: {
    fontSize: 12,
    color: '#334155',
    paddingLeft: 18,
    lineHeight: 18,
  },
  receiptTextIndentExtra: {
    fontSize: 12,
    color: '#334155',
    paddingLeft: 30,
    lineHeight: 18,
  },
  receiptTextResult: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0891B2',
    paddingLeft: 36,
    lineHeight: 20,
  },
  receiptTextResultLarge: {
    fontSize: 16,
    fontWeight: '900',
    paddingLeft: 20,
    marginTop: 4,
    lineHeight: 22,
  },
  expenseApprovalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
    marginVertical: 1,
  },
  deductionStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipPaid: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  chipPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  chipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  remittanceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  remitLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 17,
  },
  remitValue: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 17,
  },
  totalRemitRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalRemitText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  balancedStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  masterApproveBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  masterApproveBtnDark: {
    backgroundColor: '#256A71',
    borderWidth: 0.75,
    borderColor: '#FDE68A',
    shadowColor: '#0D2C30',
  },
  masterApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  approvalSignBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  approvalSignText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#065F46',
    flex: 1,
    lineHeight: 14,
  },
  waitingSignBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  waitingSignText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#B45309',
    flex: 1,
    lineHeight: 14,
  },
  stampFooter: {
    alignItems: 'center',
    paddingTop: 6,
  },
  stampFooterText: {
    fontSize: 9.5,
    color: '#0891B2',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

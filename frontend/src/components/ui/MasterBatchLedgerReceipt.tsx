// ============================================================================
// The Gem: Master Batch Ledger Bookkeeping Receipt
// Dynamic flowing thermal receipt-like bookkeeping record for the Master's account.
// Tracks and balances: Product price/kg × kg, packaging net cost × nets,
// incurred cess, transport freight, broker fees, farm loaders & sorters,
// combined with market overheads and sales inflows to produce real-time feedback.
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { BatchPurchaseCosts } from '../../types';

interface MasterBatchLedgerReceiptProps {
  isDarkMode?: boolean;
}

export const MasterBatchLedgerReceipt: React.FC<MasterBatchLedgerReceiptProps> = ({
  isDarkMode = false,
}) => {
  const {
    currentBatch,
    sales,
    expenses,
    casualLaborers,
    creditRepayments,
    storeName,
    currentUserName,
    masterName,
    role,
    updateBatchPurchaseCosts,
  } = useAppStore();

  const effectiveAdmin = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  // Edit Costs Modal State
  const [showEditCostsModal, setShowEditCostsModal] = useState(false);

  // Accordion drawer toggle states (default collapsed to avoid information clutter for non-auditors)
  const [showSourcingDetails, setShowSourcingDetails] = useState(false);
  const [showOverheadsDetails, setShowOverheadsDetails] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showBalancingDetails, setShowBalancingDetails] = useState(false);

  // Form state initialized from current batch costs
  const costs: BatchPurchaseCosts = currentBatch?.purchaseCosts || {
    pricePerKg: 95,
    avgNetWeightKg: 90,
    packagingNetUnitCost: 45,
    transportFee: 45000,
    brokerSourcingFee: 6000,
    farmLoadersSortersFee: 4500,
  };

  const [pricePerKgInput, setPricePerKgInput] = useState(String(costs.pricePerKg));
  const [avgWeightInput, setAvgWeightInput] = useState(String(costs.avgNetWeightKg));
  const [packagingCostInput, setPackagingCostInput] = useState(String(costs.packagingNetUnitCost));
  const [transportFeeInput, setTransportFeeInput] = useState(String(costs.transportFee));
  const [brokerFeeInput, setBrokerFeeInput] = useState(String(costs.brokerSourcingFee));
  const [farmLoadersInput, setFarmLoadersInput] = useState(String(costs.farmLoadersSortersFee));

  if (!currentBatch) {
    return (
      <Text style={[styles.emptyOneLinerText, isDarkMode && { color: '#CFE9EC' }]}>
        No active batch found
      </Text>
    );
  }

  // --- 1. QUANTITY & SOURCING CALCULATIONS ---
  const totalNets = currentBatch.initialGrade1Nets + currentBatch.initialGrade2Nets;
  const avgWeight = costs.avgNetWeightKg || 90;
  const totalKg = totalNets * avgWeight;
  const produceCost = totalKg * (costs.pricePerKg || 0);
  const packagingCost = totalNets * (costs.packagingNetUnitCost || 0);
  const cessPaid = currentBatch.nccCessPaid || 0;
  const transportCost = costs.transportFee || 0;
  const brokerCost = costs.brokerSourcingFee || 0;
  const farmLaborCost = costs.farmLoadersSortersFee || 0;

  const totalInboundSourcing =
    produceCost + packagingCost + cessPaid + transportCost + brokerCost + farmLaborCost;

  // --- 2. MARKET OVERHEADS CALCULATIONS ---
  // Demurrage
  const demurrageCost =
    currentBatch.dayNumber > 1 ? (currentBatch.dayNumber - 1) * 1000 : 0;

  // Filter batch expenses
  const batchExpenses = expenses;
  const watchmanExpense = batchExpenses
    .filter((e) => e.category === 'WATCHMAN' || e.description.toLowerCase().includes('watchman') || e.description.toLowerCase().includes('security'))
    .reduce((sum, e) => sum + e.amount, 0);

  const sanitationExpense = batchExpenses
    .filter(
      (e) =>
        e.category === 'CLEANER' ||
        (e.category as string) === 'SWEEPING_AND_SANITATION' ||
        e.description.toLowerCase().includes('clean') ||
        e.description.toLowerCase().includes('sweep') ||
        e.description.toLowerCase().includes('sanitation')
    )
    .reduce((sum, e) => sum + e.amount, 0);

  const casualLaborExpense = casualLaborers
    .filter((l) => l.isPaid)
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const otherExpenses = batchExpenses
    .filter(
      (e) =>
        e.category !== 'WATCHMAN' &&
        (e.category as string) !== 'SWEEPING_AND_SANITATION' &&
        e.category !== 'CLEANER' &&
        !e.description.toLowerCase().includes('watchman') &&
        !e.description.toLowerCase().includes('clean')
    )
    .reduce((sum, e) => sum + e.amount, 0);

  const totalMarketOverheads =
    demurrageCost + watchmanExpense + sanitationExpense + casualLaborExpense + otherExpenses;

  // TOTAL OUTFLOWS
  const totalOutflows = totalInboundSourcing + totalMarketOverheads;
  const averageCostPerNet = totalNets > 0 ? totalOutflows / totalNets : 0;

  // --- 3. SALES INFLOWS CALCULATIONS ---
  const batchSales = sales.filter((s) => s.batchId === currentBatch.id);

  const g1Sales = batchSales.filter((s) => s.grade === 'GRADE_1');
  const g1SoldNets = g1Sales.reduce((sum, s) => sum + s.quantityNets, 0);
  const g1Revenue = g1Sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const avgG1Price = g1SoldNets > 0 ? g1Revenue / g1SoldNets : 1300;

  const g2Sales = batchSales.filter((s) => s.grade === 'GRADE_2');
  const g2SoldNets = g2Sales.reduce((sum, s) => sum + s.quantityNets, 0);
  const g2Revenue = g2Sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const avgG2Price = g2SoldNets > 0 ? g2Revenue / g2SoldNets : 1200;

  const totalSoldNets = g1SoldNets + g2SoldNets;

  const cashSalesTotal = batchSales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const mpesaSalesTotal = batchSales
    .filter((s) => s.paymentMethod === 'MPESA')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const creditSalesTotal = batchSales
    .filter((s) => s.paymentMethod === 'CREDIT')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const repaidCreditTotal = creditRepayments.reduce((sum, r) => sum + r.amountPaid, 0);

  // Total cash & m-pesa realized into store
  const totalRealizedInflows = cashSalesTotal + mpesaSalesTotal + repaidCreditTotal;

  // Remaining stock
  const remainingG1 = Math.max(0, currentBatch.initialGrade1Nets - g1SoldNets);
  const remainingG2 = Math.max(0, currentBatch.initialGrade2Nets - g2SoldNets);
  const totalRemainingNets = remainingG1 + remainingG2;

  // Projected remaining inventory revenue at baseline prices
  const projectedRemainingRevenue = remainingG1 * avgG1Price + remainingG2 * avgG2Price;

  // Net metrics
  const currentNetPosition = totalRealizedInflows - totalOutflows;
  const projectedFinalNetProfit =
    totalRealizedInflows + projectedRemainingRevenue - totalOutflows;
  const projectedRoi = totalOutflows > 0 ? (projectedFinalNetProfit / totalOutflows) * 100 : 0;
  const profitPerNet = totalNets > 0 ? projectedFinalNetProfit / totalNets : 0;
  const costRecoveryPercent = totalOutflows > 0 ? Math.min(100, Math.round((totalRealizedInflows / totalOutflows) * 100)) : 0;

  // Open Edit Modal with refreshed values
  const handleOpenEditCosts = () => {
    setPricePerKgInput(String(costs.pricePerKg));
    setAvgWeightInput(String(costs.avgNetWeightKg));
    setPackagingCostInput(String(costs.packagingNetUnitCost));
    setTransportFeeInput(String(costs.transportFee));
    setBrokerFeeInput(String(costs.brokerSourcingFee));
    setFarmLoadersInput(String(costs.farmLoadersSortersFee));
    setShowEditCostsModal(true);
  };

  const handleSaveCosts = () => {
    const pricePerKg = parseFloat(pricePerKgInput);
    const avgNetWeightKg = parseFloat(avgWeightInput);
    const packagingNetUnitCost = parseFloat(packagingCostInput);
    const transportFee = parseFloat(transportFeeInput);
    const brokerSourcingFee = parseFloat(brokerFeeInput);
    const farmLoadersSortersFee = parseFloat(farmLoadersInput);

    if (
      isNaN(pricePerKg) ||
      isNaN(avgNetWeightKg) ||
      isNaN(packagingNetUnitCost) ||
      isNaN(transportFee) ||
      isNaN(brokerSourcingFee) ||
      isNaN(farmLoadersSortersFee)
    ) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for all cost fields.');
      return;
    }

    updateBatchPurchaseCosts({
      pricePerKg,
      avgNetWeightKg,
      packagingNetUnitCost,
      transportFee,
      brokerSourcingFee,
      farmLoadersSortersFee,
    });

    setShowEditCostsModal(false);
    Alert.alert('✅ Costs Updated', 'Master purchase expenses updated and ledger receipt recalculated.');
  };

  const monospaceFont = Platform.OS === 'ios' ? 'Courier' : 'monospace';

  return (
    <View style={[styles.wrapper, isDarkMode && styles.wrapperDark]}>
      {/* Title & Receipt Container */}
      <View style={[styles.receiptPaper, isDarkMode && styles.receiptPaperDark]}>
        {/* Serrated Top Edge Effect */}
        <View style={styles.serratedEdge}>
          <Text style={styles.serratedText}>- - - - - - - - - - - - - - - - - - - - - - - - - - - -</Text>
        </View>

        {/* Master Account Header */}
        <View style={styles.receiptHeader}>
          <View style={[styles.masterPill, isDarkMode && { backgroundColor: '#164E63', borderColor: '#0891B2' }]}>
            <Ionicons name="shield-checkmark" size={13} color={isDarkMode ? '#38BDF8' : '#0891B2'} />
            <Text style={[styles.masterPillText, isDarkMode && { color: '#E0F2FE' }]}>MASTER ACCOUNT BOOKKEEPING</Text>
          </View>
          <Text style={[styles.storeTitle, { fontFamily: monospaceFont }, isDarkMode && { color: '#F8FAFC' }]}>
            {(storeName || 'NKACE ENTERPRISE').toUpperCase()}
          </Text>
          <Text style={[styles.marketSub, { fontFamily: monospaceFont }, isDarkMode && { color: '#94A3B8' }]}>
            WAKULIMA WHOLESALE MARKET • NAIROBI
          </Text>
          <Text style={[styles.receiptSubtext, { fontFamily: monospaceFont }, isDarkMode && { color: '#38BDF8' }]}>
            STALL REGISTER • ADMIN: {effectiveAdmin.toUpperCase()}
          </Text>
          <Text style={[styles.receiptDate, { fontFamily: monospaceFont }, isDarkMode && { color: '#64748B' }]}>
            BATCH #{currentBatch.batchNumber} • TRUCK: {currentBatch.truckPlate} • DAY {currentBatch.dayNumber} OF 4
          </Text>
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }, isDarkMode && { color: '#334155' }]}>
          ----------------------------------------
        </Text>

        {/* --- SIMPLIFIED OVERVIEW FOR NON-AUDITORS --- */}
        <View style={[styles.quickOverviewCard, isDarkMode && { backgroundColor: '#0B1120', borderColor: '#1E293B' }]}>
          <Text style={[styles.overviewTitle, { fontFamily: monospaceFont }, isDarkMode && { color: '#F8FAFC' }]}>
            ★ CONSIGNMENT SUMMARY (MZIGO KWA UFUPI) ★
          </Text>

          <View style={styles.kpiRow}>
            {/* Money In */}
            <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#052E16' : '#F0FDF4', borderColor: isDarkMode ? '#166534' : '#BBF7D0' }]}>
              <View style={styles.kpiLabelRow}>
                <Ionicons name="arrow-down-circle" size={14} color="#16A34A" />
                <Text style={[styles.kpiHeaderLabel, { color: isDarkMode ? '#4ADE80' : '#166534' }]}>MONEY IN (MAUZO)</Text>
              </View>
              <Text style={[styles.kpiValueLarge, { color: isDarkMode ? '#4ADE80' : '#166534', fontFamily: monospaceFont }]}>
                Ksh {totalRealizedInflows.toLocaleString()}
              </Text>
              <Text style={[styles.kpiSubNotice, isDarkMode && { color: '#86EFAC' }]}>Cash Drawer + Till In Hand</Text>
            </View>

            {/* Money Out */}
            <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#450A0A' : '#FEF2F2', borderColor: isDarkMode ? '#991B1B' : '#FECACA' }]}>
              <View style={styles.kpiLabelRow}>
                <Ionicons name="arrow-up-circle" size={14} color="#DC2626" />
                <Text style={[styles.kpiHeaderLabel, { color: isDarkMode ? '#F87171' : '#991B1B' }]}>MONEY OUT (GHARAMA)</Text>
              </View>
              <Text style={[styles.kpiValueLarge, { color: isDarkMode ? '#F87171' : '#991B1B', fontFamily: monospaceFont }]}>
                Ksh {totalOutflows.toLocaleString()}
              </Text>
              <Text style={[styles.kpiSubNotice, isDarkMode && { color: '#FCA5A5' }]}>Sourcing + Overheads Paid</Text>
            </View>
          </View>

          <View style={[styles.kpiRow, { marginTop: 8 }]}>
            {/* Projected Profit */}
            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: projectedFinalNetProfit >= 0 ? (isDarkMode ? '#083344' : '#ECFEFF') : (isDarkMode ? '#451A03' : '#FFFBEB'),
                  borderColor: projectedFinalNetProfit >= 0 ? (isDarkMode ? '#0891B2' : '#A5F3FC') : (isDarkMode ? '#B45309' : '#FDE68A'),
                },
              ]}
            >
              <View style={styles.kpiLabelRow}>
                <Ionicons
                  name={projectedFinalNetProfit >= 0 ? 'wallet' : 'warning'}
                  size={14}
                  color={projectedFinalNetProfit >= 0 ? '#0891B2' : '#D97706'}
                />
                <Text
                  style={[
                    styles.kpiHeaderLabel,
                    { color: projectedFinalNetProfit >= 0 ? (isDarkMode ? '#38BDF8' : '#0E7490') : (isDarkMode ? '#FBBF24' : '#B45309') },
                  ]}
                >
                  EST. PROFIT (FAIDA)
                </Text>
              </View>
              <Text
                style={[
                  styles.kpiValueLarge,
                  {
                    color: projectedFinalNetProfit >= 0 ? (isDarkMode ? '#38BDF8' : '#0E7490') : (isDarkMode ? '#FBBF24' : '#B45309'),
                    fontFamily: monospaceFont,
                  },
                ]}
              >
                {projectedFinalNetProfit >= 0 ? '+' : ''}Ksh {projectedFinalNetProfit.toLocaleString()}
              </Text>
              <Text style={[styles.kpiSubNotice, isDarkMode && { color: '#94A3B8' }]}>
                {projectedRoi.toFixed(0)}% ROI • Ksh {profitPerNet.toFixed(0)}/net
              </Text>
            </View>

            {/* Stock Left */}
            <View style={[styles.kpiCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
              <View style={styles.kpiLabelRow}>
                <Ionicons name="cube" size={14} color="#0891B2" />
                <Text style={[styles.kpiHeaderLabel, { color: isDarkMode ? '#94A3B8' : '#334155' }]}>NETS LEFT (ZIMEBAKI)</Text>
              </View>
              <Text style={[styles.kpiValueLarge, { color: isDarkMode ? '#F8FAFC' : '#0F172A', fontFamily: monospaceFont }]}>
                {totalRemainingNets} NETS
              </Text>
              <Text style={[styles.kpiSubNotice, isDarkMode && { color: '#64748B' }]}>
                Sold {totalSoldNets} of {totalNets} nets
              </Text>
            </View>
          </View>

          {/* Quick Progress Indicator */}
          <View style={[styles.miniProgressRow, isDarkMode && { backgroundColor: '#0F172A', borderColor: '#1E293B' }]}>
            <Text style={[styles.miniProgressText, { fontFamily: monospaceFont }, isDarkMode && { color: '#38BDF8' }]}>
              Status: {currentNetPosition >= 0 ? 'Surplus (+Ksh ' + currentNetPosition.toLocaleString() + ')' : 'Recovering Capital (' + costRecoveryPercent + '% cleared)'}
            </Text>
          </View>
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }, isDarkMode && { color: '#334155' }]}>
          ----------------------------------------
        </Text>

        {/* Section 1: Inbound Purchasing Expenses */}
        <View style={styles.receiptSection}>
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setShowSourcingDetails(!showSourcingDetails)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="car-outline" size={15} color="#0891B2" />
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }]}>
                  1. SOURCING & INBOUND
                </Text>
              </View>
              <Text style={styles.accordionSub}>
                Subtotal: Ksh {totalInboundSourcing.toLocaleString()}
              </Text>
            </View>
            <View style={styles.accordionRightRow}>
              <TouchableOpacity
                style={styles.editCostsBtn}
                onPress={handleOpenEditCosts}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={12} color="#0891B2" />
                <Text style={styles.editCostsBtnText}>Edit</Text>
              </TouchableOpacity>
              <View style={styles.togglePill}>
                <Text style={styles.togglePillText}>
                  {showSourcingDetails ? 'Hide ▴' : 'Show Details ▾'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {showSourcingDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Produce ({totalNets} nets × {avgWeight}kg @ Ksh {costs.pricePerKg}/kg)
                  </Text>
                  <Text style={styles.subItemNote}>Bulk farm field sourcing cost ({totalKg.toLocaleString()} kg)</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {produceCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Packaging Sacks ({totalNets} nets @ Ksh {costs.packagingNetUnitCost}/net)
                  </Text>
                  <Text style={styles.subItemNote}>Durable red mesh onion sacks</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {packagingCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Incurred Day 1 NCC County Cess
                  </Text>
                  <Text style={styles.subItemNote}>Official barcode receipt ({currentBatch.nccDeclaredNets} nets counted)</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {cessPaid.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Long-Distance Haulage / Transport
                  </Text>
                  <Text style={styles.subItemNote}>Flat truck haulage freight into Nairobi</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {transportCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Farm Broker Sourcing Commission
                  </Text>
                  <Text style={styles.subItemNote}>Origin liaison & field negotiation fee</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {brokerCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Farm Sorters & Loaders
                  </Text>
                  <Text style={styles.subItemNote}>Manual field grading & truck loading labor</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {farmLaborCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.subtotalRow}>
                <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }]}>
                  SUBTOTAL INBOUND SOURCING
                </Text>
                <Text style={[styles.subtotalAmount, { fontFamily: monospaceFont }]}>
                  Ksh {totalInboundSourcing.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }]}>
          ----------------------------------------
        </Text>

        {/* Section 2: Market Overheads */}
        <View style={styles.receiptSection}>
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setShowOverheadsDetails(!showOverheadsDetails)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="storefront-outline" size={15} color="#0891B2" />
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }]}>
                  2. MARKET OVERHEADS
                </Text>
              </View>
              <Text style={styles.accordionSub}>
                Subtotal: Ksh {totalMarketOverheads.toLocaleString()}
              </Text>
            </View>
            <View style={styles.togglePill}>
              <Text style={styles.togglePillText}>
                {showOverheadsDetails ? 'Hide ▴' : 'Show Details ▾'}
              </Text>
            </View>
          </TouchableOpacity>

          {showOverheadsDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Daily Demurrage (Day {currentBatch.dayNumber} of 4)
                  </Text>
                  <Text style={styles.subItemNote}>
                    {currentBatch.dayNumber === 1
                      ? 'Day 1 covered under initial Cess'
                      : `Days 2–${currentBatch.dayNumber}: flat Ksh 1,000/day`}
                  </Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {demurrageCost.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Night Security Watchman
                  </Text>
                  <Text style={styles.subItemNote}>Ksh 100/night overnight custody</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {watchmanExpense.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Sweeping & Sanitation Fee
                  </Text>
                  <Text style={styles.subItemNote}>Market bay daily hygiene maintenance</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {sanitationExpense.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Market Offloaders (Casual Labor)
                  </Text>
                  <Text style={styles.subItemNote}>Discharged offloading workers</Text>
                </View>
                <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                  Ksh {casualLaborExpense.toLocaleString()}
                </Text>
              </View>

              {otherExpenses > 0 && (
                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                      Other Miscellaneous Overheads
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }]}>
                    Ksh {otherExpenses.toLocaleString()}
                  </Text>
                </View>
              )}

              <View style={styles.subtotalRow}>
                <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }]}>
                  SUBTOTAL MARKET OVERHEADS
                </Text>
                <Text style={[styles.subtotalAmount, { fontFamily: monospaceFont }]}>
                  Ksh {totalMarketOverheads.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }]}>
          ========================================
        </Text>

        {/* Total Outflows Summary Card */}
        <View style={styles.totalOutflowsRow}>
          <View>
            <Text style={[styles.grandLabel, { fontFamily: monospaceFont }]}>
              TOTAL INCURRED OUTFLOWS
            </Text>
            <Text style={styles.subGrandLabel}>
              Effective Landed Cost: Ksh {averageCostPerNet.toFixed(1)} / net
            </Text>
          </View>
          <Text style={[styles.grandOutflowAmount, { fontFamily: monospaceFont }]}>
            -Ksh {totalOutflows.toLocaleString()}
          </Text>
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }]}>
          ----------------------------------------
        </Text>

        {/* Section 3: Real-Time Sales Inflows */}
        <View style={styles.receiptSection}>
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setShowSalesDetails(!showSalesDetails)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cash-outline" size={15} color="#059669" />
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }]}>
                  3. SALES & CASH DRAWER
                </Text>
              </View>
              <Text style={styles.accordionSub}>
                Realized Inflows: +Ksh {totalRealizedInflows.toLocaleString()}
              </Text>
            </View>
            <View style={styles.togglePill}>
              <Text style={styles.togglePillText}>
                {showSalesDetails ? 'Hide ▴' : 'Show Details ▾'}
              </Text>
            </View>
          </TouchableOpacity>

          {showSalesDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Grade 1 Nets Sold ({g1SoldNets} of {currentBatch.initialGrade1Nets} nets)
                  </Text>
                  <Text style={styles.subItemNote}>Avg wholesale realized: Ksh {avgG1Price.toFixed(0)}/net</Text>
                </View>
                <Text style={[styles.itemAmountInflow, { fontFamily: monospaceFont }]}>
                  +Ksh {g1Revenue.toLocaleString()}
                </Text>
              </View>

              <View style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemLabel, { fontFamily: monospaceFont }]}>
                    Grade 2 Nets Sold ({g2SoldNets} of {currentBatch.initialGrade2Nets} nets)
                  </Text>
                  <Text style={styles.subItemNote}>Avg wholesale realized: Ksh {avgG2Price.toFixed(0)}/net</Text>
                </View>
                <Text style={[styles.itemAmountInflow, { fontFamily: monospaceFont }]}>
                  +Ksh {g2Revenue.toLocaleString()}
                </Text>
              </View>

              {/* Collection Channels */}
              <View style={styles.channelsBox}>
                <Text style={[styles.channelsHeading, { fontFamily: monospaceFont }]}>
                  COLLECTION CHANNELS:
                </Text>
                <Text style={[styles.channelItem, { fontFamily: monospaceFont }]}>
                  • Cash Drawer In Hand : Ksh {cashSalesTotal.toLocaleString()}
                </Text>
                <Text style={[styles.channelItem, { fontFamily: monospaceFont }]}>
                  • M-Pesa Buy Goods Till: Ksh {mpesaSalesTotal.toLocaleString()}
                </Text>
                {repaidCreditTotal > 0 && (
                  <Text style={[styles.channelItem, { fontFamily: monospaceFont }]}>
                    • Debtor Repayments    : Ksh {repaidCreditTotal.toLocaleString()}
                  </Text>
                )}
                {creditSalesTotal > 0 && (
                  <Text style={[styles.channelItemPending, { fontFamily: monospaceFont }]}>
                    • Active Debts (Unpaid): Ksh {creditSalesTotal.toLocaleString()}
                  </Text>
                )}
              </View>

              <View style={styles.subtotalRow}>
                <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }]}>
                  TOTAL REALIZED INFLOWS
                </Text>
                <Text style={[styles.subtotalAmountInflow, { fontFamily: monospaceFont }]}>
                  +Ksh {totalRealizedInflows.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.dashedDivider, { fontFamily: monospaceFont }]}>
          ========================================
        </Text>

        {/* Section 4: Real-Time Balancing & Batch Feedback */}
        <View style={styles.balancingSection}>
          {/* Actionable Feedback Banner Always Visible */}
          <View
            style={[
              styles.feedbackBanner,
              projectedFinalNetProfit >= 0 ? styles.feedbackBannerSuccess : styles.feedbackBannerWarning,
            ]}
          >
            <Ionicons
              name={projectedFinalNetProfit >= 0 ? 'trending-up' : 'alert-circle'}
              size={18}
              color={projectedFinalNetProfit >= 0 ? '#059669' : '#D97706'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackBannerTitle}>
                {projectedFinalNetProfit >= 0
                  ? currentNetPosition >= 0
                    ? '🎉 FULL RECOVERY ACHIEVED — RUNNING SURPLUS'
                    : '📈 PROFITABLE BATCH TRAJECTORY'
                  : '⚠️ MARGIN COMPRESSION ALERT'}
              </Text>
              <Text style={styles.feedbackBannerText}>
                {currentNetPosition >= 0
                  ? `All sourcing and overhead expenses fully cleared. All remaining ${totalRemainingNets} nets represent 100% net surplus.`
                  : `Batch has recovered ${costRecoveryPercent}% of capital. Selling the remaining ${totalRemainingNets} nets at target rates will secure Ksh ${projectedFinalNetProfit.toLocaleString()} net profit.`}
              </Text>
            </View>
          </View>

          {/* Toggle for Deep Audit Calculations */}
          <TouchableOpacity
            style={styles.accordionHeaderBtn}
            onPress={() => setShowBalancingDetails(!showBalancingDetails)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }]}>
                4. AUDIT VALUATION & PROJECTIONS
              </Text>
              <Text style={styles.accordionSub}>
                Net Position: {currentNetPosition >= 0 ? '+' : ''}Ksh {currentNetPosition.toLocaleString()}
              </Text>
            </View>
            <View style={styles.togglePill}>
              <Text style={styles.togglePillText}>
                {showBalancingDetails ? 'Hide ▴' : 'Show Details ▾'}
              </Text>
            </View>
          </TouchableOpacity>

          {showBalancingDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.balanceStatusRow}>
                <Text style={[styles.balanceStatusLabel, { fontFamily: monospaceFont }]}>
                  CURRENT NET POSITION (TO DATE):
                </Text>
                <Text
                  style={[
                    styles.balanceStatusValue,
                    {
                      fontFamily: monospaceFont,
                      color: currentNetPosition >= 0 ? '#059669' : '#DC2626',
                    },
                  ]}
                >
                  {currentNetPosition >= 0 ? '+' : ''}Ksh {currentNetPosition.toLocaleString()}
                </Text>
              </View>

              <View style={styles.progressStatusRow}>
                <Text style={[styles.progressStatusText, { fontFamily: monospaceFont }]}>
                  Cost Recovery: {costRecoveryPercent}% • Sold: {totalSoldNets}/{totalNets} nets (
                  {totalRemainingNets} left)
                </Text>
              </View>

              {/* Remaining Stock Valuation */}
              <View style={styles.projectionBox}>
                <View style={styles.projLine}>
                  <Text style={[styles.projLabel, { fontFamily: monospaceFont }]}>
                    Unsold Stock Valuation ({totalRemainingNets} nets):
                  </Text>
                  <Text style={[styles.projValue, { fontFamily: monospaceFont }]}>
                    Ksh {projectedRemainingRevenue.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.projLine}>
                  <Text style={[styles.projLabelBold, { fontFamily: monospaceFont }]}>
                    PROJECTED FULL CLEARANCE PROFIT:
                  </Text>
                  <Text
                    style={[
                      styles.projValueBold,
                      {
                        fontFamily: monospaceFont,
                        color: projectedFinalNetProfit >= 0 ? '#059669' : '#DC2626',
                      },
                    ]}
                  >
                    {projectedFinalNetProfit >= 0 ? '+' : ''}Ksh {projectedFinalNetProfit.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.projLine}>
                  <Text style={[styles.projLabel, { fontFamily: monospaceFont }]}>
                    Expected Consignment ROI:
                  </Text>
                  <Text style={[styles.projValue, { fontFamily: monospaceFont }]}>
                    {projectedRoi.toFixed(1)}% (Ksh {profitPerNet.toFixed(0)}/net profit)
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Serrated Bottom Edge Effect */}
        <View style={styles.serratedEdge}>
          <Text style={styles.serratedText}>- - - - - - - - - - - - - - - - - - - - - - - - - - - -</Text>
        </View>

        {/* Stamp */}
        <View style={[styles.stampBox, isDarkMode && { borderColor: '#334155', backgroundColor: '#0F172A' }]}>
          <Text style={[styles.stampText, { fontFamily: monospaceFont }, isDarkMode && { color: '#38BDF8' }]}>
            [ MASTER AUDIT RECORD • {storeName || 'NKACE ENTERPRISE'} • VERIFIED ]
          </Text>
        </View>
      </View>

      {/* --- EDIT SOURCING COSTS MODAL --- */}
      <Modal
        visible={showEditCostsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditCostsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="calculator" size={20} color="#0891B2" />
                <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>
                  Enquire / Update Purchase Expenses
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditCostsModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94A3B8' }]}>
                Adjust the truck consignment purchasing expenses below to dynamically balance the Master bookkeeping receipt.
              </Text>

              {/* Produce Price per Kg */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Produce Price per Kg (Ksh/kg)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={pricePerKgInput}
                  onChangeText={setPricePerKgInput}
                  keyboardType="numeric"
                  placeholder="e.g. 95"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Bulk farm purchase price per kilogram</Text>
              </View>

              {/* Avg Net Weight Kg */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Average Net Weight (kg/net)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={avgWeightInput}
                  onChangeText={setAvgWeightInput}
                  keyboardType="numeric"
                  placeholder="e.g. 90"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Standard packed net weight (e.g. 90kg sack)</Text>
              </View>

              {/* Packaging Sacks Price per Net */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Empty Packaging Net Cost (Ksh/net)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={packagingCostInput}
                  onChangeText={setPackagingCostInput}
                  keyboardType="numeric"
                  placeholder="e.g. 45"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Multiplied by total nets ({totalNets} nets)</Text>
              </View>

              {/* Incurred Transport Freight */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Incurred Long-Distance Transport (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={transportFeeInput}
                  onChangeText={setTransportFeeInput}
                  keyboardType="numeric"
                  placeholder="e.g. 45000"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Total multi-ton truck freight haulage into Nairobi</Text>
              </View>

              {/* Sourcing Broker Fee */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Incurred Sourcing Broker Commission (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={brokerFeeInput}
                  onChangeText={setBrokerFeeInput}
                  keyboardType="numeric"
                  placeholder="e.g. 6000"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Origin farm agent commission</Text>
              </View>

              {/* Farm Loaders & Sorters */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && styles.textWhite]}>
                  Farm Sorters & Loaders Fee (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={farmLoadersInput}
                  onChangeText={setFarmLoadersInput}
                  keyboardType="numeric"
                  placeholder="e.g. 4500"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.inputHint}>Field manual grading and truck loading labor</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowEditCostsModal(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveCosts}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>Save & Recalculate</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 14,
    marginBottom: 16,
  },
  wrapperDark: {},
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
  },
  emptyOneLinerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  emptyContainerDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  textWhite: {
    color: '#F0FDFA',
  },
  receiptPaper: {
    backgroundColor: '#FFFDF7',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  receiptPaperDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
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
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  masterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  masterPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  storeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  marketSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  receiptSubtext: {
    fontSize: 11,
    color: '#0891B2',
    marginTop: 2,
    fontWeight: '600',
  },
  receiptDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  dashedDivider: {
    color: '#CBD5E1',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 4,
    overflow: 'hidden',
  },
  // Simplified Overview Styles
  quickOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginVertical: 6,
  },
  overviewTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  kpiHeaderLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  kpiValueLarge: {
    fontSize: 14,
    fontWeight: '900',
    marginVertical: 1,
  },
  kpiSubNotice: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  miniProgressRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  miniProgressText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
  },
  // Accordion Section Styles
  accordionHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  accordionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  accordionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  togglePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  togglePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
  },
  accordionBody: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  receiptSection: {
    marginVertical: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  editCostsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  editCostsBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  itemLabel: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  subItemNote: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  itemAmount: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '700',
  },
  itemAmountInflow: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  subtotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  subtotalAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  subtotalAmountInflow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  totalOutflowsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  grandLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  subGrandLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  grandOutflowAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
  },
  channelsBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  channelsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  channelItem: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 14,
  },
  channelItemPending: {
    fontSize: 10,
    color: '#D97706',
    lineHeight: 14,
  },
  balancingSection: {
    marginVertical: 6,
  },
  balanceStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  balanceStatusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  balanceStatusValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressStatusRow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  progressStatusText: {
    fontSize: 10,
    color: '#64748B',
  },
  projectionBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    gap: 3,
  },
  projLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projLabel: {
    fontSize: 10,
    color: '#475569',
  },
  projValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  projLabelBold: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  projValueBold: {
    fontSize: 12,
    fontWeight: '900',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  feedbackBannerSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  feedbackBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  feedbackBannerText: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 13,
  },
  stampBox: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stampText: {
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    maxHeight: '85%',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCardDark: {
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    marginTop: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  modalInputDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  inputHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#0891B2',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

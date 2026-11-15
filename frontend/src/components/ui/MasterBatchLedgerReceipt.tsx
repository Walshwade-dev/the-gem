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
  Linking,
  Share,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { BatchPurchaseCosts } from '../../types';

interface MasterBatchLedgerReceiptProps {
  isDarkMode?: boolean;
  selectedBatchId?: string;
  onEditMarketExpenses?: () => void;
}

export const MasterBatchLedgerReceipt: React.FC<MasterBatchLedgerReceiptProps> = ({
  isDarkMode = false,
  selectedBatchId,
  onEditMarketExpenses,
}) => {
  const {
    currentBatch: storeCurrentBatch,
    historicalBatches,
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

  const currentBatch =
    (selectedBatchId
      ? [storeCurrentBatch, ...historicalBatches].find((b) => b?.id === selectedBatchId)
      : storeCurrentBatch) ?? storeCurrentBatch;

  const effectiveAdmin = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  // Edit Costs Modal State
  const [showEditCostsModal, setShowEditCostsModal] = useState(false);

  // Accordion drawer toggle states (default collapsed to avoid information clutter for non-auditors)
  const [showSourcingDetails, setShowSourcingDetails] = useState(false);
  const [showOverheadsDetails, setShowOverheadsDetails] = useState(false);
  const [showSalesDetails, setShowSalesDetails] = useState(false);
  const [showCollectionChannels, setShowCollectionChannels] = useState(false);

  // Form state initialized from current batch costs (defaults to 0 until manually entered)
  const costs: BatchPurchaseCosts = {
    pricePerKg: currentBatch?.purchaseCosts?.pricePerKg ?? 0,
    avgNetWeightKg: currentBatch?.purchaseCosts?.avgNetWeightKg ?? 0,
    packagingNetUnitCost: currentBatch?.purchaseCosts?.packagingNetUnitCost ?? 0,
    transportFee: currentBatch?.purchaseCosts?.transportFee ?? 0,
    brokerSourcingFee: currentBatch?.purchaseCosts?.brokerSourcingFee ?? 0,
    farmLoadersSortersFee: currentBatch?.purchaseCosts?.farmLoadersSortersFee ?? 0,
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
  const avgWeight = costs.avgNetWeightKg || 0;
  const totalKg = totalNets * avgWeight;
  const produceCost = totalKg * (costs.pricePerKg || 0);
  const packagingCost = totalNets * (costs.packagingNetUnitCost || 0);
  const cessPaid = currentBatch.isNccCessPaid ? (currentBatch.nccCessPaid || 0) : 0;
  const transportCost = costs.transportFee || 0;
  const brokerCost = costs.brokerSourcingFee || 0;
  const farmLaborCost = costs.farmLoadersSortersFee || 0;

  const totalInboundSourcing =
    produceCost + packagingCost + cessPaid + transportCost + brokerCost + farmLaborCost;

  // --- 2. MARKET OVERHEADS CALCULATIONS ---
  // Only count expenses and labor explicitly logged and settled (isPaid === true) for this batch
  const batchExpenses = expenses.filter(
    (e) => e.batchId === currentBatch.id && e.isPaid === true
  );

  const isNccDailyExpense = (e: (typeof batchExpenses)[number]) => {
    const desc = e.description.toLowerCase();
    return (
      e.category === 'DEMURRAGE' ||
      (e.category as string) === 'NCC_CESS' ||
      (e.category as string) === 'COUNTY_CESS' ||
      (e.category as string) === 'NCC_DAILY' ||
      desc.includes('ncc') ||
      desc.includes('demurrage') ||
      desc.includes('cess')
    );
  };

  const isWatchmanExpense = (e: (typeof batchExpenses)[number]) => {
    const desc = e.description.toLowerCase();
    return e.category === 'WATCHMAN' || desc.includes('watchman') || desc.includes('security');
  };

  const isSanitationExpense = (e: (typeof batchExpenses)[number]) => {
    const desc = e.description.toLowerCase();
    return (
      e.category === 'CLEANER' ||
      (e.category as string) === 'SWEEPING_AND_SANITATION' ||
      desc.includes('clean') ||
      desc.includes('sweep') ||
      desc.includes('sanitation')
    );
  };

  const demurrageCost = batchExpenses
    .filter(isNccDailyExpense)
    .reduce((sum, e) => sum + e.amount, 0);

  const watchmanExpense = batchExpenses
    .filter((e) => !isNccDailyExpense(e) && isWatchmanExpense(e))
    .reduce((sum, e) => sum + e.amount, 0);

  const sanitationExpense = batchExpenses
    .filter((e) => !isNccDailyExpense(e) && !isWatchmanExpense(e) && isSanitationExpense(e))
    .reduce((sum, e) => sum + e.amount, 0);

  const casualLaborExpense = casualLaborers
    .filter((l) => l.batchId === currentBatch.id && l.isPaid)
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const otherExpenseItems = batchExpenses.filter(
    (e) => !isNccDailyExpense(e) && !isWatchmanExpense(e) && !isSanitationExpense(e)
  );
  const otherExpenses = otherExpenseItems.reduce((sum, e) => sum + e.amount, 0);

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
  const avgG1Price = g1SoldNets > 0 ? g1Revenue / g1SoldNets : 0;

  const g2Sales = batchSales.filter((s) => s.grade === 'GRADE_2');
  const g2SoldNets = g2Sales.reduce((sum, s) => sum + s.quantityNets, 0);
  const g2Revenue = g2Sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const avgG2Price = g2SoldNets > 0 ? g2Revenue / g2SoldNets : 0;

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

  const repaidCreditTotal = creditRepayments
    .filter((r) => r.batchId === currentBatch.id)
    .reduce((sum, r) => sum + r.amountPaid, 0);

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
        {/* Master Account Header */}
        <View style={styles.receiptHeader}>
          <Text style={[styles.storeTitle, { fontFamily: monospaceFont }, isDarkMode && { color: '#F8FAFC' }]}>
            The Gem
          </Text>
          <Text
            style={[styles.receiptDate, { fontFamily: monospaceFont, fontSize: 10 }, isDarkMode && { color: '#CFE9EC' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            BATCH #{currentBatch.batchNumber} • TRUCK: {currentBatch.truckPlate} • DAY {currentBatch.dayNumber} OF 4
          </Text>
        </View>

        {/* --- BATCH SUMMARY --- */}
        <View style={[styles.quickOverviewCard, isDarkMode && styles.quickOverviewCardDark]}>
          <Text style={[styles.overviewTitle, { fontFamily: monospaceFont }, isDarkMode && { color: '#F8FAFC' }]}>
            BATCH SUMMARY
          </Text>

          <View style={styles.summaryList}>
            {/* Sales */}
            <View style={[styles.summaryListRow, isDarkMode && styles.summaryListRowDark]}>
              <View style={styles.summaryListLeft}>
                <Ionicons name="arrow-down-circle" size={15} color={isDarkMode ? '#4ADE80' : '#16A34A'} />
                <View>
                  <Text style={[styles.summaryListLabel, isDarkMode && { color: '#F0FDFA' }]}>
                    Sales
                  </Text>
                  <Text style={[styles.summaryListSub, isDarkMode && { color: '#CFE9EC' }]}>
                    Cash Drawer + Till In Hand
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryListValue, { color: isDarkMode ? '#4ADE80' : '#166534', fontFamily: monospaceFont }]}>
                Ksh {totalRealizedInflows.toLocaleString()}
              </Text>
            </View>

            {/* Expenses */}
            <View style={[styles.summaryListRow, isDarkMode && styles.summaryListRowDark]}>
              <View style={styles.summaryListLeft}>
                <Ionicons name="arrow-up-circle" size={15} color={isDarkMode ? '#F87171' : '#DC2626'} />
                <View>
                  <Text style={[styles.summaryListLabel, isDarkMode && { color: '#F0FDFA' }]}>
                    Expenses
                  </Text>
                  <Text style={[styles.summaryListSub, isDarkMode && { color: '#CFE9EC' }]}>
                    Sourcing + Overheads Paid
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryListValue, { color: isDarkMode ? '#F87171' : '#991B1B', fontFamily: monospaceFont }]}>
                Ksh {totalOutflows.toLocaleString()}
              </Text>
            </View>

            {/* Nets Left */}
            <View style={[styles.summaryListRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={styles.summaryListLeft}>
                <Ionicons name="cube" size={15} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
                <View>
                  <Text style={[styles.summaryListLabel, isDarkMode && { color: '#F0FDFA' }]}>
                    Nets Left
                  </Text>
                  <Text style={[styles.summaryListSub, isDarkMode && { color: '#CFE9EC' }]}>
                    Sold {totalSoldNets} of {totalNets} nets
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryListValue, { color: isDarkMode ? '#FFFFFF' : '#0F172A', fontFamily: monospaceFont }]}>
                {totalRemainingNets} NETS
              </Text>
            </View>
          </View>
        </View>

        {/* Merged Sourcing & Market Expenses Container */}
        <View style={[styles.expensesGroupCard, isDarkMode && styles.expensesGroupCardDark]}>
          {/* Section 1: Sourcing Expenses */}
          <View style={styles.receiptSection}>
            <TouchableOpacity
              style={styles.accordionHeaderBtn}
              onPress={() => setShowSourcingDetails(!showSourcingDetails)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }, isDarkMode && { color: '#FFFFFF' }]}>
                  1. SOURCING EXPENSES
                </Text>
                <Text style={[styles.accordionSub, isDarkMode && { color: '#CFE9EC' }]}>
                  Subtotal: Ksh {totalInboundSourcing.toLocaleString()}
                </Text>
              </View>
              <View style={styles.accordionRightRow}>
                <TouchableOpacity
                  style={[styles.editCostsBtn, isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC' }]}
                  onPress={handleOpenEditCosts}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={12} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
                  <Text style={[styles.editCostsBtnText, isDarkMode && { color: '#7DD3FC' }]}>Edit</Text>
                </TouchableOpacity>
                <View style={[styles.togglePill, isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC', borderWidth: 1 }]}>
                  <Text style={[styles.togglePillText, isDarkMode && { color: '#E0F2FE' }]}>
                    {showSourcingDetails ? 'Hide ▴' : 'Show Details ▾'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {showSourcingDetails && (
              <View style={styles.accordionBody}>
                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Produce ({totalNets} nets × {avgWeight}kg @ Ksh {costs.pricePerKg}/kg)
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {produceCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Packaging Sacks ({totalNets} nets @ Ksh {costs.packagingNetUnitCost}/net)
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {packagingCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      NCC County Cess
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {cessPaid.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Transport
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {transportCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Broker Commission
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {brokerCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Loaders
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {farmLaborCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.subtotalRow}>
                  <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    SUBTOTAL SOURCING EXPENSES
                  </Text>
                  <Text style={[styles.subtotalAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {totalInboundSourcing.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Section 2: Market Expenses */}
          <View style={[styles.receiptSection, styles.expensesSectionDivider, isDarkMode && styles.expensesSectionDividerDark]}>
            <TouchableOpacity
              style={styles.accordionHeaderBtn}
              onPress={() => setShowOverheadsDetails(!showOverheadsDetails)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }, isDarkMode && { color: '#FFFFFF' }]}>
                  2. MARKET EXPENSES
                </Text>
                <Text style={[styles.accordionSub, isDarkMode && { color: '#CFE9EC' }]}>
                  Subtotal: Ksh {totalMarketOverheads.toLocaleString()}
                </Text>
              </View>
              <View style={styles.accordionRightRow}>
                {onEditMarketExpenses && (
                  <TouchableOpacity
                    style={[
                      styles.editCostsBtn,
                      isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC' },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                    onPress={onEditMarketExpenses}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={12} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
                    <Text style={[styles.editCostsBtnText, isDarkMode && { color: '#7DD3FC' }]}>Edit</Text>
                  </TouchableOpacity>
                )}
                <View style={[styles.togglePill, isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC', borderWidth: 1 }]}>
                  <Text style={[styles.togglePillText, isDarkMode && { color: '#E0F2FE' }]}>
                    {showOverheadsDetails ? 'Hide ▴' : 'Show Details ▾'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {showOverheadsDetails && (
              <View style={styles.accordionBody}>
                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      NCC Daily Expense
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {demurrageCost.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Security Watchman
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {watchmanExpense.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Sweeping & Sanitation
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {sanitationExpense.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Offloaders
                    </Text>
                  </View>
                  <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {casualLaborExpense.toLocaleString()}
                  </Text>
                </View>

                {otherExpenseItems.map((exp) => (
                  <View key={exp.id} style={styles.lineItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                        {exp.description}
                      </Text>
                    </View>
                    <Text style={[styles.itemAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                      Ksh {exp.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}

                <View style={styles.subtotalRow}>
                  <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    SUBTOTAL MARKET EXPENSES
                  </Text>
                  <Text style={[styles.subtotalAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    Ksh {totalMarketOverheads.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Total Expenses Summary Row */}
          <View style={[styles.totalOutflowsRow, styles.expensesSectionDivider, isDarkMode && styles.expensesSectionDividerDark]}>
            <View>
              <Text style={[styles.grandLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                TOTAL EXPENSES
              </Text>
              <Text style={[styles.subGrandLabel, isDarkMode && { color: '#CFE9EC' }]}>
                Effective Landed Cost: Ksh {averageCostPerNet.toFixed(1)} / net
              </Text>
            </View>
            <Text style={[styles.grandOutflowAmount, { fontFamily: monospaceFont }, isDarkMode && { color: '#FCA5A5' }]}>
              -Ksh {totalOutflows.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Section 3: Real-Time Sales Inflows */}
        <View style={[styles.expensesGroupCard, isDarkMode && styles.expensesGroupCardDark]}>
          <View style={styles.receiptSection}>
            <TouchableOpacity
              style={styles.accordionHeaderBtn}
              onPress={() => setShowSalesDetails(!showSalesDetails)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { fontFamily: monospaceFont, marginBottom: 0 }, isDarkMode && { color: '#FFFFFF' }]}>
                  3. SALES
                </Text>
              </View>
              <View style={[styles.togglePill, isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC', borderWidth: 1 }]}>
                <Text style={[styles.togglePillText, isDarkMode && { color: '#E0F2FE' }]}>
                  {showSalesDetails ? 'Hide ▴' : 'Show Details ▾'}
                </Text>
              </View>
            </TouchableOpacity>

            {showSalesDetails && (
              <View style={styles.accordionBody}>
                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Grade 1 Nets Sold ({g1SoldNets} of {currentBatch.initialGrade1Nets} nets)
                    </Text>
                    <Text style={[styles.subItemNote, isDarkMode && { color: '#CFE9EC' }]}>Avg wholesale realized: Ksh {avgG1Price.toFixed(0)}/net</Text>
                  </View>
                  <Text style={[styles.itemAmountInflow, { fontFamily: monospaceFont }, isDarkMode && { color: '#6EE7B7' }]}>
                    +Ksh {g1Revenue.toLocaleString()}
                  </Text>
                </View>

                <View style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                      Grade 2 Nets Sold ({g2SoldNets} of {currentBatch.initialGrade2Nets} nets)
                    </Text>
                    <Text style={[styles.subItemNote, isDarkMode && { color: '#CFE9EC' }]}>Avg wholesale realized: Ksh {avgG2Price.toFixed(0)}/net</Text>
                  </View>
                  <Text style={[styles.itemAmountInflow, { fontFamily: monospaceFont }, isDarkMode && { color: '#6EE7B7' }]}>
                    +Ksh {g2Revenue.toLocaleString()}
                  </Text>
                </View>

                {/* Collection Channels (Collapsible) */}
                <View style={[styles.channelsBox, isDarkMode && styles.channelsBoxDark]}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setShowCollectionChannels((prev) => !prev)}
                    style={[
                      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                  >
                    <Text
                      style={[
                        styles.channelsHeading,
                        !showCollectionChannels && { marginBottom: 0 },
                        isDarkMode && { color: '#7DD3FC' },
                      ]}
                    >
                      COLLECTION CHANNELS
                    </Text>
                    <Ionicons
                      name={showCollectionChannels ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={isDarkMode ? '#7DD3FC' : '#64748B'}
                    />
                  </TouchableOpacity>

                  {showCollectionChannels && (
                    <>
                      <View style={[styles.channelRow, { paddingTop: 2 }, isDarkMode && styles.channelRowDark]}>
                        <Text style={[styles.channelItemLabel, isDarkMode && { color: '#E2F5F7' }]}>
                          Cash Drawer In Hand
                        </Text>
                        <Text style={[styles.channelItemValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                          Ksh {cashSalesTotal.toLocaleString()}
                        </Text>
                      </View>

                      <View style={[styles.channelRow, isDarkMode && styles.channelRowDark]}>
                        <Text style={[styles.channelItemLabel, isDarkMode && { color: '#E2F5F7' }]}>
                          M-Pesa Buy Goods Till
                        </Text>
                        <Text style={[styles.channelItemValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                          Ksh {mpesaSalesTotal.toLocaleString()}
                        </Text>
                      </View>

                      {repaidCreditTotal > 0 && (
                        <View style={[styles.channelRow, isDarkMode && styles.channelRowDark]}>
                          <Text style={[styles.channelItemLabel, isDarkMode && { color: '#E2F5F7' }]}>
                            Debtor Repayments
                          </Text>
                          <Text style={[styles.channelItemValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#F0FDFA' }]}>
                            Ksh {repaidCreditTotal.toLocaleString()}
                          </Text>
                        </View>
                      )}

                      {creditSalesTotal > 0 && (
                        <View style={[styles.channelRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                          <Text style={[styles.channelItemPending, isDarkMode && { color: '#FCD34D' }]}>
                            Active Debts (Unpaid)
                          </Text>
                          <Text style={[styles.channelItemPendingValue, { fontFamily: monospaceFont }, isDarkMode && { color: '#FCD34D' }]}>
                            Ksh {creditSalesTotal.toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.subtotalRow}>
                  <Text style={[styles.subtotalLabel, { fontFamily: monospaceFont }, isDarkMode && { color: '#FFFFFF' }]}>
                    TOTAL SALES
                  </Text>
                  <Text style={[styles.subtotalAmountInflow, { fontFamily: monospaceFont }, isDarkMode && { color: '#6EE7B7' }]}>
                    +Ksh {totalRealizedInflows.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
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
              <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>
                Update Purchase Expenses
              </Text>
              <TouchableOpacity
                onPress={() => setShowEditCostsModal(false)}
                style={[styles.modalCloseBtn, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
              >
                <Ionicons name="close" size={20} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Produce Price per Kg */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Produce Price (Ksh/kg)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={pricePerKgInput}
                  onChangeText={setPricePerKgInput}
                  keyboardType="numeric"
                  placeholder="e.g. 95"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Avg Net Weight Kg */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Average Net Weight (kg/net)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={avgWeightInput}
                  onChangeText={setAvgWeightInput}
                  keyboardType="numeric"
                  placeholder="e.g. 90"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Packaging Sacks Price per Net */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Packaging Sacks (Ksh/net)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={packagingCostInput}
                  onChangeText={setPackagingCostInput}
                  keyboardType="numeric"
                  placeholder="e.g. 45"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Transport */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Transport (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={transportFeeInput}
                  onChangeText={setTransportFeeInput}
                  keyboardType="numeric"
                  placeholder="e.g. 45000"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Broker Commission */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Broker Commission (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={brokerFeeInput}
                  onChangeText={setBrokerFeeInput}
                  keyboardType="numeric"
                  placeholder="e.g. 6000"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Loaders */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#F0FDFA' }]}>
                  Loaders (Ksh)
                </Text>
                <TextInput
                  style={[styles.modalInput, isDarkMode && styles.modalInputDark]}
                  value={farmLoadersInput}
                  onChangeText={setFarmLoadersInput}
                  keyboardType="numeric"
                  placeholder="e.g. 4500"
                  placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.modalCancelBtn,
                    isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC' },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                  onPress={() => setShowEditCostsModal(false)}
                >
                  <Text style={[styles.modalCancelBtnText, isDarkMode && { color: '#F0FDFA' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    isDarkMode && { backgroundColor: '#059669' },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
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

/**
 * Standalone Dispatch Report Card rendered below Today's Drawer so reports
 * are sent after reviewing all batch receipts, expenses, and drawer totals.
 */
export const BatchDispatchReportCard: React.FC<{
  isDarkMode?: boolean;
  selectedBatchId?: string;
}> = ({ isDarkMode = false, selectedBatchId }) => {
  const {
    currentBatch: storeCurrentBatch,
    historicalBatches,
    sales,
    expenses,
    casualLaborers,
    creditRepayments,
  } = useAppStore();

  const currentBatch =
    (selectedBatchId
      ? [storeCurrentBatch, ...historicalBatches].find((b) => b?.id === selectedBatchId)
      : storeCurrentBatch) ?? storeCurrentBatch;

  if (!currentBatch) return null;

  const totalNets = currentBatch.initialGrade1Nets + currentBatch.initialGrade2Nets;
  const costs = currentBatch.purchaseCosts;
  const avgWeight = costs?.avgNetWeightKg ?? 0;
  const produceCost = totalNets * avgWeight * (costs?.pricePerKg ?? 0);
  const packagingCost = totalNets * (costs?.packagingNetUnitCost ?? 0);
  const cessPaid = currentBatch.isNccCessPaid ? currentBatch.nccCessPaid || 0 : 0;
  const totalInboundSourcing =
    produceCost +
    packagingCost +
    cessPaid +
    (costs?.transportFee ?? 0) +
    (costs?.brokerSourcingFee ?? 0) +
    (costs?.farmLoadersSortersFee ?? 0);

  const settledExpenses = expenses
    .filter((e) => e.batchId === currentBatch.id && e.isPaid === true)
    .reduce((sum, e) => sum + e.amount, 0);
  const settledLabor = casualLaborers
    .filter((l) => l.batchId === currentBatch.id && l.isPaid)
    .reduce((sum, l) => sum + l.agreedWage, 0);
  const totalOutflows = totalInboundSourcing + settledExpenses + settledLabor;

  const batchSales = sales.filter((s) => s.batchId === currentBatch.id);
  const totalSoldNets = batchSales.reduce((sum, s) => sum + s.quantityNets, 0);
  const totalRemainingNets = Math.max(0, totalNets - totalSoldNets);
  const cashSalesTotal = batchSales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const mpesaSalesTotal = batchSales
    .filter((s) => s.paymentMethod === 'MPESA')
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const repaidCreditTotal = creditRepayments
    .filter((r) => r.batchId === currentBatch.id)
    .reduce((sum, r) => sum + r.amountPaid, 0);
  const totalRealizedInflows = cashSalesTotal + mpesaSalesTotal + repaidCreditTotal;
  const currentNetPosition = totalRealizedInflows - totalOutflows;

  const dispatchMessage = async (channel: 'EMAIL' | 'SMS') => {
    if (channel === 'EMAIL') {
      const subject = encodeURIComponent(
        `Batch Reconciliation - ${currentBatch.batchNumber} (${currentBatch.truckPlate})`
      );
      const bodyText =
        `Batch: ${currentBatch.batchNumber} (${currentBatch.truckPlate})\n` +
        `Sold: ${totalSoldNets}/${totalNets} nets (${totalRemainingNets} left)\n` +
        `Sales: Ksh ${totalRealizedInflows.toLocaleString()}\n` +
        `Expenses: Ksh ${totalOutflows.toLocaleString()}\n` +
        `Net Position: Ksh ${currentNetPosition.toLocaleString()}`;
      const mailUrl = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
      try {
        const supported = await Linking.canOpenURL(mailUrl);
        if (supported) {
          await Linking.openURL(mailUrl);
        } else {
          await Share.share({ message: bodyText, title: 'Batch Reconciliation Report' });
        }
      } catch {
        await Share.share({ message: bodyText, title: 'Batch Reconciliation Report' });
      }
      return;
    }

    const smsBody =
      `RECONCILIATION ${currentBatch.batchNumber} (${currentBatch.truckPlate}): ` +
      `Sold ${totalSoldNets}/${totalNets} nets (${totalRemainingNets} left). ` +
      `In: Ksh ${totalRealizedInflows.toLocaleString()}, ` +
      `Out: Ksh ${totalOutflows.toLocaleString()}, ` +
      `Net: Ksh ${currentNetPosition.toLocaleString()}.`;
    const smsUrl = `sms:?body=${encodeURIComponent(smsBody)}`;
    try {
      const supported = await Linking.canOpenURL(smsUrl);
      if (supported) {
        await Linking.openURL(smsUrl);
      } else {
        await Share.share({ message: smsBody, title: 'Batch Reconciliation SMS' });
      }
    } catch {
      await Share.share({ message: smsBody, title: 'Batch Reconciliation SMS' });
    }
  };

  return (
    <View style={[styles.dispatchStandaloneCard, isDarkMode && styles.dispatchStandaloneCardDark]}>
      <Text style={[styles.dispatchSectionTitle, isDarkMode && { color: '#CFE9EC' }]}>
        DISPATCH REPORT
      </Text>
      <View style={styles.dispatchRow}>
        <TouchableOpacity
          style={[
            styles.dispatchBtn,
            styles.dispatchEmailBtn,
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
          activeOpacity={0.85}
          onPress={() => dispatchMessage('EMAIL')}
        >
          <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
          <Text style={styles.dispatchBtnText}>Email Master</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dispatchBtn,
            styles.dispatchSmsBtn,
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
          activeOpacity={0.85}
          onPress={() => dispatchMessage('SMS')}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
          <Text style={styles.dispatchBtnText}>Send via SMS</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  receiptPaperDark: {
    backgroundColor: '#1B4F55',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
    padding: 12,
    marginVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  quickOverviewCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.25,
  },
  overviewTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  summaryList: {
    gap: 8,
  },
  summaryListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryListRowDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.25)',
  },
  summaryListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  summaryListLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryListSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  summaryListValue: {
    fontSize: 13,
    fontWeight: '900',
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
  expensesGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  expensesGroupCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.25,
  },
  expensesSectionDivider: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expensesSectionDividerDark: {
    borderTopColor: 'rgba(122, 181, 188, 0.25)',
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
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
  },
  channelsBoxDark: {
    backgroundColor: '#1B4F55',
  },
  channelsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  channelRowDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.2)',
  },
  channelItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  channelItemValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  channelItemPending: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  channelItemPendingValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
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
  dispatchStandaloneCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  dispatchStandaloneCardDark: {
    backgroundColor: '#1B4F55',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  dispatchSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dispatchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dispatchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  dispatchEmailBtn: {
    backgroundColor: '#0891B2',
  },
  dispatchSmsBtn: {
    backgroundColor: '#059669',
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.35,
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
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
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

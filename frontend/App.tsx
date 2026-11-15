// ============================================================================
// The Gem: Onion Sales Tracker (Wakulima Market Wholesale Suite)
// Main Application Screen - Mobile-First Responsive Shell (Turquoise Blue Theme)
// ============================================================================

import './global.css';
import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ClerkProvider, useAuth, useClerk } from '@clerk/expo';
import { clerkTokenCache } from './src/services/authStorage';
import { registerClerkTokenGetter } from './src/services/api';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  Text, 
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from './src/constants/theme';
import { useAppStore } from './src/store/useAppStore';
import { UserRole } from './src/types';

// Components
import { Header } from './src/components/Header';
import { BatchOverviewCard } from './src/components/BatchOverviewCard';
import { ImageLightboxModal, LightboxImageItem } from './src/components/ui/ImageLightboxModal';
import { SalesLogger } from './src/components/SalesLogger';
import { FinancialSummaryCard } from './src/components/FinancialSummaryCard';
import { LockdownScreen } from './src/components/LockdownScreen';
import { LoginScreen } from './src/components/LoginScreen';

// Modals
import { ReconciliationModal } from './src/components/ReconciliationModal';
import { CreditLedgerModal } from './src/components/CreditLedgerModal';
import { NewBatchModal } from './src/components/NewBatchModal';
import { ExpensesLaborModal } from './src/components/ExpensesLaborModal';
import { SellerManagementModal } from './src/components/SellerManagementModal';
import { AuthModal } from './src/components/AuthModal';

// Design System UI Components (Guided by Reference Specification)
import { LiquidGlassBottomBar, MainAppTab } from './src/components/ui/LiquidGlassBottomBar';
import { FilterChips, FilterChipOption } from './src/components/ui/FilterChips';
import { ProduceListingCard, ProduceListingItem } from './src/components/ui/ProduceListingCard';
import { UserProfileSection } from './src/components/ui/UserProfileSection';
import { StatusAlertToast } from './src/components/ui/StatusAlertToast';
import { MasterBatchLedgerReceipt, BatchDispatchReportCard } from './src/components/ui/MasterBatchLedgerReceipt';
import { CreditRecordsView } from './src/components/ui/CreditRecordsView';
import { DailyClosureReceipt } from './src/components/ui/DailyClosureReceipt';
import { NotificationsModal } from './src/components/ui/NotificationsModal';
import { BatchProduceModal } from './src/components/ui/BatchProduceModal';

function MainScreen() {
  const {
    isLockedDown,
    isAuthenticated,
    role,
    sales,
    currentBatch,
    historicalBatches,
    expenses,
    customerCredits,
    batchProducts,
    deleteBatchProduct,
    selectActiveBatch,
    approveCreditSale,
    rejectCreditSale,
    resetToSampleData,
    isDarkMode,
  } = useAppStore(
    useShallow((s) => ({
      isLockedDown: s.isLockedDown,
      isAuthenticated: s.isAuthenticated,
      role: s.role,
      sales: s.sales,
      currentBatch: s.currentBatch,
      historicalBatches: s.historicalBatches,
      expenses: s.expenses,
      customerCredits: s.customerCredits,
      batchProducts: s.batchProducts,
      deleteBatchProduct: s.deleteBatchProduct,
      selectActiveBatch: s.selectActiveBatch,
      approveCreditSale: s.approveCreditSale,
      rejectCreditSale: s.rejectCreditSale,
      resetToSampleData: s.resetToSampleData,
      isDarkMode: s.isDarkMode,
    }))
  );

  // Pending Credit Requests for Merchant Live Action
  const pendingCreditRequests = useMemo(
    () =>
      customerCredits.flatMap((c) =>
        c.records
          .filter((r) => r.approvalStatus === 'PENDING')
          .map((r) => ({
            ...r,
            customerName: c.customerName,
            customerPhone: c.customerPhone,
            customerNationalId: c.customerNationalId,
          }))
      ),
    [customerCredits]
  );

  // Modal Visibility States
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showReconciliation, setShowReconciliation] = useState<boolean>(false);
  const [showCreditLedger, setShowCreditLedger] = useState<boolean>(false);
  const [showNewBatch, setShowNewBatch] = useState<boolean>(false);
  const [showExpensesLabor, setShowExpensesLabor] = useState<boolean>(false);
  const [showSellerManagement, setShowSellerManagement] = useState<boolean>(false);
  const [showAuth, setShowAuth] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<UserRole>('SELLER');
  const [showBatchProduceModal, setShowBatchProduceModal] = useState<boolean>(false);
  const [batchModalInitialMode, setBatchModalInitialMode] = useState<'view' | 'add' | 'prices'>('view');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [hasSelectedSalesBatch, setHasSelectedSalesBatch] = useState<boolean>(false);

  const activeBatchesList = useMemo(() => {
    const productBatchIds = new Set(batchProducts.map((p) => p.batchId).filter(Boolean));
    const all = [currentBatch, ...historicalBatches].filter(
      (b): b is NonNullable<typeof b> =>
        Boolean(b && b.status === 'ACTIVE' && productBatchIds.has(b.id))
    );
    return all.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [currentBatch, historicalBatches, batchProducts]);

  const formatShortOriginForBatch = (batch: NonNullable<typeof currentBatch>) => {
    const reg = batch.origin.regionName || '';
    const spec = batch.origin.specificLocation || '';
    if (/singida/i.test(reg) || /singida/i.test(spec)) return 'Singida, Tanzania';
    if (/tanzania/i.test(reg)) return 'Northern Tanzania';
    const clean = reg.split('(')[0].trim();
    const words = clean.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ') || 'Singida, Tanzania';
  };
  const [lightboxState, setLightboxState] = useState<{
    visible: boolean;
    images: LightboxImageItem[];
    initialIndex: number;
  }>({ visible: false, images: [], initialIndex: 0 });

  // Bottom Liquid Glass Navigation State & Filter Chips
  const [activeNavTab, setActiveNavTab] = useState<MainAppTab>('sales');
  const [ledgerSubTab, setLedgerSubTab] = useState<'bookkeeping' | 'credit_records' | 'daily_closures'>('bookkeeping');
  const [selectedLedgerBatchId, setSelectedLedgerBatchId] = useState<string>('');
  const [showLedgerBatchFilter, setShowLedgerBatchFilter] = useState<boolean>(false);
  const [selectedProduceFilter, setSelectedProduceFilter] = useState<string>('ALL');
  const [toastNotification, setToastNotification] = useState<{
    type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
    title: string;
    message?: string;
  } | null>(null);

  // Helper: Format Place of Origin to 1 or 2 names maximum
  const getBatchShortOrigin = () => {
    if (!currentBatch) return 'Singida, Tanzania';
    const reg = currentBatch.origin.regionName || '';
    const spec = currentBatch.origin.specificLocation || '';
    if (/singida/i.test(reg) || /singida/i.test(spec)) return 'Singida, Tanzania';
    if (/tanzania/i.test(reg)) return 'Northern Tanzania';
    if (/kajiado/i.test(reg) || /oloitokitok/i.test(reg) || /rom/i.test(spec)) return 'Loitokitok, Kenya';
    if (/naivasha/i.test(reg)) return 'Naivasha, Kenya';
    const clean = reg.split('(')[0].trim();
    const words = clean.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ') || 'Singida, Tanzania';
  };

  // Live Sales Stream Filtering & Pagination
  const [showStreamFilters, setShowStreamFilters] = useState<boolean>(false);
  const [streamDayFilter, setStreamDayFilter] = useState<string>('ALL');
  const [streamHourFilter, setStreamHourFilter] = useState<string>('ALL');
  const [streamSellerFilter, setStreamSellerFilter] = useState<string>('ALL');
  const [streamBatchFilter, setStreamBatchFilter] = useState<string>('ALL');
  const [streamVisibleCount, setStreamVisibleCount] = useState<number>(8);

  const allKnownBatches = useMemo(
    () => [currentBatch, ...historicalBatches].filter((b): b is NonNullable<typeof b> => Boolean(b)),
    [currentBatch, historicalBatches]
  );

  const ledgerBatch = useMemo(
    () => allKnownBatches.find((b) => b.id === selectedLedgerBatchId) || currentBatch || allKnownBatches[0] || null,
    [allKnownBatches, selectedLedgerBatchId, currentBatch]
  );

  const streamDayOptions = useMemo(() => {
    const days = new Set<string>();
    for (const s of sales) {
      const d = new Date(s.timestamp);
      if (!isNaN(d.getTime())) days.add(d.toISOString().slice(0, 10));
    }
    return Array.from(days).sort((a, b) => b.localeCompare(a));
  }, [sales]);

  const streamHourOptions = useMemo(() => {
    const hours = new Set<string>();
    for (const s of sales) {
      const d = new Date(s.timestamp);
      if (isNaN(d.getTime())) continue;
      if (streamDayFilter !== 'ALL' && d.toISOString().slice(0, 10) !== streamDayFilter) continue;
      hours.add(String(d.getHours()).padStart(2, '0'));
    }
    return Array.from(hours).sort((a, b) => b.localeCompare(a));
  }, [sales, streamDayFilter]);

  const streamSellerOptions = useMemo(() => {
    const sellers = new Set<string>();
    for (const s of sales) {
      if (s.sellerName) sellers.add(s.sellerName);
    }
    return Array.from(sellers).sort();
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.timestamp);
      const dayKey = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
      const hourKey = !isNaN(d.getTime()) ? String(d.getHours()).padStart(2, '0') : '';
      if (streamDayFilter !== 'ALL' && dayKey !== streamDayFilter) return false;
      if (streamHourFilter !== 'ALL' && hourKey !== streamHourFilter) return false;
      if (streamSellerFilter !== 'ALL' && s.sellerName !== streamSellerFilter) return false;
      if (role === 'MERCHANT' && streamBatchFilter !== 'ALL' && s.batchId !== streamBatchFilter) return false;
      return true;
    });
  }, [sales, streamDayFilter, streamHourFilter, streamSellerFilter, streamBatchFilter, role]);

  const activeStreamFilterCount =
    (streamDayFilter !== 'ALL' ? 1 : 0) +
    (streamHourFilter !== 'ALL' ? 1 : 0) +
    (streamSellerFilter !== 'ALL' ? 1 : 0) +
    (role === 'MERCHANT' && streamBatchFilter !== 'ALL' ? 1 : 0);

  const produceFilterOptions: FilterChipOption[] = [
    { id: 'ALL', label: 'All Stock', count: batchProducts.length },
    { id: 'GRADE_1', label: 'Grade 1', count: batchProducts.filter(p => p.grade === 'GRADE_1').length },
    { id: 'GRADE_2', label: 'Grade 2', count: batchProducts.filter(p => p.grade === 'GRADE_2').length },
    { id: '100KG', label: '100kg Nets', count: batchProducts.filter(p => p.packaging === '100KG_NET').length },
    { id: '50KG', label: '50kg Bags', count: batchProducts.filter(p => p.packaging === '50KG_BAG').length },
  ];

  const filteredProduce = batchProducts.filter(item => {
    if (selectedProduceFilter === 'GRADE_1') return item.grade === 'GRADE_1';
    if (selectedProduceFilter === 'GRADE_2') return item.grade === 'GRADE_2';
    if (selectedProduceFilter === '100KG') return item.packaging === '100KG_NET';
    if (selectedProduceFilter === '50KG') return item.packaging === '50KG_BAG';
    return true;
  });

  // If system detects breach or panic triggered, freeze entire UI
  if (isLockedDown) {
    return <LockdownScreen />;
  }

  // If user is not authenticated, show dedicated Mobile Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleResetData = () => {
    Alert.alert(
      'Reset Demo Data?',
      'This will reload authentic Wakulima Market sample figures for demonstration.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: () => resetToSampleData() }
      ]
    );
  };

  const handleDeleteProduct = (prod: ProduceListingItem) => {
    Alert.alert(
      prod.availableBags === 0 ? 'Remove Finished Product?' : 'Remove Product Entirely?',
      `Are you sure you want to permanently remove "${prod.title}" from the products catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Entirely',
          style: 'destructive',
          onPress: () => {
            deleteBatchProduct(prod.id);
            setToastNotification({
              type: 'INFO',
              title: 'Product Removed',
              message: `"${prod.title}" has been permanently removed from catalog.`,
            });
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.rootBackground, isDarkMode && styles.rootBackgroundDark]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Mobile-First Centered Container for Responsive Display */}
      <View style={[styles.mobileShell, isDarkMode && styles.mobileShellDark]}>
        {/* 1. Brand Header (Clean Top Bar with Faceted Onion Identity) */}
        <Header 
          onOpenCreditLedger={() => {
            setActiveNavTab('credits');
            setLedgerSubTab('credit_records');
          }}
          onOpenNotifications={() => setShowNotifications(true)}
        />

        {/* Global Status & Feedback Alert (From Reference Sheet) */}
        {toastNotification && (
          <StatusAlertToast
            type={toastNotification.type}
            title={toastNotification.title}
            message={toastNotification.message}
            onDismiss={() => setToastNotification(null)}
            isDarkMode={isDarkMode}
          />
        )}

        <ScrollView 
          style={[styles.scrollView, isDarkMode && styles.scrollViewDark]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TAB 1: LIVE SALES & OPERATIONS */}
          {activeNavTab === 'sales' && (
            role === 'MERCHANT' && !hasSelectedSalesBatch && activeBatchesList.length > 0 ? (
              <View style={styles.salesBatchPickerSection}>
                <View style={styles.tabSectionHeader}>
                  <Text style={[styles.tabSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                    SELECT BATCH FOR SALES ({activeBatchesList.length} ACTIVE)
                  </Text>
                  <Text style={[styles.tabSectionSubtitle, isDarkMode && { color: '#CFE9EC' }]}>
                    Choose which active truck batch to sell from. Batches remain active until fully sold and reconciled.
                  </Text>
                </View>

                {activeBatchesList.map((batch) => {
                  const hasGrade2 =
                    batch.initialGrade2Nets > 0 || (batch.pricePerBagGrade2 ?? 0) > 0;
                  return (
                    <TouchableOpacity
                      key={batch.id}
                      style={[
                        styles.salesBatchPickCard,
                        isDarkMode && styles.salesBatchPickCardDark,
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        selectActiveBatch(batch.id);
                        setHasSelectedSalesBatch(true);
                      }}
                    >
                      {/* Row 1: Batch ID */}
                      <View style={styles.batchIdRow}>
                        <View style={[styles.produceBatchBadge, isDarkMode && styles.produceBatchBadgeDark]}>
                          <Text
                            style={[styles.produceBatchBadgeText, isDarkMode && { color: '#FDE68A' }]}
                            numberOfLines={1}
                          >
                            {batch.batchNumber}
                          </Text>
                        </View>
                      </View>

                      {/* Row 2: Source Location & Hauling Truck Reg Plate on the far right */}
                      <View style={styles.batchSourceTruckRow}>
                        <View style={styles.batchTopOriginWrap}>
                          <Ionicons
                            name="location-outline"
                            size={13}
                            color={isDarkMode ? '#FDE68A' : '#0891B2'}
                          />
                          <Text
                            style={[styles.batchTopMetaText, isDarkMode && { color: '#F0FDFA' }]}
                            numberOfLines={1}
                          >
                            {formatShortOriginForBatch(batch)}
                          </Text>
                        </View>
                        <View style={styles.batchTruckWrap}>
                          <Ionicons
                            name="car-outline"
                            size={13}
                            color={isDarkMode ? '#CFE9EC' : '#475569'}
                          />
                          <Text
                            style={[styles.batchTopMetaTruck, isDarkMode && { color: '#CFE9EC' }]}
                            numberOfLines={1}
                          >
                            {batch.truckPlate}
                          </Text>
                        </View>
                      </View>

                      {/* Row 3: Grades, Price & Quantity in List Form */}
                      <View style={[styles.batchSummaryBox, isDarkMode && styles.batchSummaryBoxDark]}>
                        <View
                          style={[
                            styles.batchListRow,
                            isDarkMode && styles.batchListRowDark,
                            !hasGrade2 && { borderBottomWidth: 0, paddingBottom: 0 },
                          ]}
                        >
                          <Text style={[styles.batchListLabel, isDarkMode && { color: '#B4D6D9' }]}>
                            Grade 1 (Ksh {batch.pricePerBagGrade1?.toLocaleString() ?? 1300})
                          </Text>
                          <Text
                            style={[
                              styles.batchListValue,
                              { color: isDarkMode ? '#FDE68A' : '#0891B2' },
                            ]}
                          >
                            {batch.remainingGrade1Nets} nets left
                          </Text>
                        </View>

                        {hasGrade2 && (
                          <View
                            style={[
                              styles.batchListRow,
                              { borderBottomWidth: 0, paddingBottom: 0 },
                            ]}
                          >
                            <Text style={[styles.batchListLabel, isDarkMode && { color: '#B4D6D9' }]}>
                              Grade 2 (Ksh {batch.pricePerBagGrade2?.toLocaleString() ?? 1000})
                            </Text>
                            <Text
                              style={[
                                styles.batchListValue,
                                { color: isDarkMode ? '#FDE68A' : '#0F766E' },
                              ]}
                            >
                              {batch.remainingGrade2Nets} nets left
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
            <>
              {role === 'MERCHANT' && activeBatchesList.length > 0 && currentBatch && (
                <View style={[styles.switchBatchBar, isDarkMode && styles.switchBatchBarDark]}>
                  <TouchableOpacity
                    style={styles.switchBatchBtn}
                    onPress={() => setHasSelectedSalesBatch(false)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="swap-horizontal" size={15} color={isDarkMode ? '#FDE68A' : '#0891B2'} />
                    <Text style={[styles.switchBatchBtnText, isDarkMode && { color: '#FDE68A' }]}>
                      Switch Batch ({activeBatchesList.length} Active)
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.switchBatchActiveLabel, isDarkMode && { color: '#CFE9EC' }]} numberOfLines={1}>
                    {currentBatch.batchNumber} • {currentBatch.truckPlate}
                  </Text>
                </View>
              )}

              {/* 2. Active Truck Batch & Current Stock Card */}
              <BatchOverviewCard 
                onOpenNewBatchModal={() => {
                  setActiveNavTab('catalog');
                  setBatchModalInitialMode('add');
                  setShowBatchProduceModal(true);
                }}
              />

              {/* Only show sales operations when an active product stock batch exists in products */}
              {currentBatch && batchProducts.length > 0 && (
                <>

          {/* 2.5 Live Merchant Credit Approval Action Center */}
          {role === 'MERCHANT' && pendingCreditRequests.length > 0 && (
            <View style={[styles.approvalNoticeCard, isDarkMode && styles.approvalNoticeCardDark]}>
              <View style={styles.approvalNoticeHeader}>
                <View style={styles.approvalNoticeTitleRow}>
                  <Ionicons name="notifications" size={17} color="#D97706" />
                  <Text style={[styles.approvalNoticeTitle, isDarkMode && { color: '#FCD34D' }]}>
                    CREDIT APPROVAL REQUIRED ({pendingCreditRequests.length})
                  </Text>
                </View>
                <View style={styles.liveIndicatorBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>

              <Text style={[styles.approvalSubtitle, isDarkMode && { color: '#CBD5E1' }]}>
                A seller has logged credit requiring your sign-off under Kenya DPA. Review and authorize below:
              </Text>

              {pendingCreditRequests.map(req => (
                <View key={req.id} style={[styles.pendingItemBox, isDarkMode && styles.pendingItemBoxDark]}>
                  <View style={styles.pendingItemHeader}>
                    <View>
                      <Text style={[styles.pendingDebtorName, isDarkMode && { color: '#F8FAFC' }]}>
                        {req.customerName}
                      </Text>
                      <Text style={[styles.pendingDebtorId, isDarkMode && { color: '#22D3EE' }]}>
                        National ID: {req.buyerNationalId || req.customerNationalId || 'N/A'} • {req.customerPhone}
                      </Text>
                    </View>
                    <View style={styles.pendingDebtBadge}>
                      <Text style={styles.pendingDebtText}>
                        Ksh {req.totalOwed.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pendingDetailsContainer}>
                    <Text style={[styles.pendingStockDetail, isDarkMode && { color: '#E2E8F0' }]}>
                      📦 {req.quantityNets} nets of {req.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} • Truck: {req.truckPlate}
                    </Text>
                    {req.guarantorName ? (
                      <Text style={[styles.pendingAuthDetail, isDarkMode && { color: '#CFE9EC' }]}>
                        🛡️ Guaranteed by: <Text style={{ fontWeight: '700' }}>{req.guarantorName}</Text> (ID: {req.guarantorNationalId || 'Verified'})
                      </Text>
                    ) : (
                      <Text style={[styles.pendingAuthDetail, isDarkMode && { color: '#34D399' }]}>
                        📲 Debtor SMS Agreement Confirmed via "YES" reply
                      </Text>
                    )}
                  </View>

                  <View style={styles.approvalButtonsContainer}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => {
                        approveCreditSale(req.id);
                        Alert.alert(
                          '✅ Credit Sale Approved',
                          `Credit of Ksh ${req.totalOwed.toLocaleString()} for ${req.customerName} (ID: ${req.buyerNationalId || req.customerNationalId}) has been confirmed and finalized.`
                        );
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                      <Text style={styles.approveButtonText}>Approve Credit Sale</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => {
                        Alert.alert(
                          'Reject Credit Request?',
                          `Reject credit for ${req.customerName} (Ksh ${req.totalOwed.toLocaleString()})? The allocated nets will be restored to bay stock.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Reject Request',
                              style: 'destructive',
                              onPress: () => {
                                rejectCreditSale(req.id);
                                Alert.alert('Credit Sale Rejected', `Credit request cancelled and stock restored to bay.`);
                              }
                            }
                          ]
                        );
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={15} color="#DC2626" />
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 3. Real-time Sales Logger (Available to both Merchant & Seller) */}
          <SalesLogger />

          {/* 4. Live Feed of Recorded Transactions */}
          <View style={styles.transactionsSection}>
            <View style={styles.transHeaderRow}>
              <View style={styles.transTitleRow}>
                <MaterialCommunityIcons name="history" size={17} color={THEME.colors.primary} />
                <Text style={styles.transTitle}>LIVE SALES STREAM (MAUZO YA SASA)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={[
                    styles.streamFilterToggleBtn,
                    isDarkMode && styles.streamFilterToggleBtnDark,
                    (showStreamFilters || activeStreamFilterCount > 0) && styles.streamFilterToggleBtnActive,
                  ]}
                  onPress={() => setShowStreamFilters(!showStreamFilters)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="funnel-outline"
                    size={12}
                    color={(showStreamFilters || activeStreamFilterCount > 0) ? '#FFFFFF' : (isDarkMode ? '#CFE9EC' : '#0891B2')}
                  />
                  <Text
                    style={[
                      styles.streamFilterToggleText,
                      isDarkMode && { color: '#CFE9EC' },
                      (showStreamFilters || activeStreamFilterCount > 0) && { color: '#FFFFFF' },
                    ]}
                  >
                    Filter{activeStreamFilterCount > 0 ? ` (${activeStreamFilterCount})` : ''}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.transCountBadge}>{filteredSales.length} sales</Text>
              </View>
            </View>

            {showStreamFilters && (
              <View style={[styles.streamFilterPanel, isDarkMode && styles.streamFilterPanelDark]}>
                <View style={styles.streamFilterGroup}>
                  <Text style={[styles.streamFilterLabel, isDarkMode && { color: '#B4D6D9' }]}>DAY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.streamChipRow}>
                    <TouchableOpacity
                      style={[styles.streamChip, streamDayFilter === 'ALL' && styles.streamChipActive]}
                      onPress={() => setStreamDayFilter('ALL')}
                    >
                      <Text style={[styles.streamChipText, streamDayFilter === 'ALL' && styles.streamChipTextActive]}>All Days</Text>
                    </TouchableOpacity>
                    {streamDayOptions.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[styles.streamChip, streamDayFilter === day && styles.streamChipActive]}
                        onPress={() => setStreamDayFilter(day)}
                      >
                        <Text style={[styles.streamChipText, streamDayFilter === day && styles.streamChipTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.streamFilterGroup}>
                  <Text style={[styles.streamFilterLabel, isDarkMode && { color: '#B4D6D9' }]}>HOUR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.streamChipRow}>
                    <TouchableOpacity
                      style={[styles.streamChip, streamHourFilter === 'ALL' && styles.streamChipActive]}
                      onPress={() => setStreamHourFilter('ALL')}
                    >
                      <Text style={[styles.streamChipText, streamHourFilter === 'ALL' && styles.streamChipTextActive]}>All Hours</Text>
                    </TouchableOpacity>
                    {streamHourOptions.map((hr) => (
                      <TouchableOpacity
                        key={hr}
                        style={[styles.streamChip, streamHourFilter === hr && styles.streamChipActive]}
                        onPress={() => setStreamHourFilter(hr)}
                      >
                        <Text style={[styles.streamChipText, streamHourFilter === hr && styles.streamChipTextActive]}>{hr}:00</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {streamSellerOptions.length > 0 && (
                  <View style={styles.streamFilterGroup}>
                    <Text style={[styles.streamFilterLabel, isDarkMode && { color: '#B4D6D9' }]}>SALESPERSON</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.streamChipRow}>
                      <TouchableOpacity
                        style={[styles.streamChip, streamSellerFilter === 'ALL' && styles.streamChipActive]}
                        onPress={() => setStreamSellerFilter('ALL')}
                      >
                        <Text style={[styles.streamChipText, streamSellerFilter === 'ALL' && styles.streamChipTextActive]}>All Sellers</Text>
                      </TouchableOpacity>
                      {streamSellerOptions.map((sellerName) => (
                        <TouchableOpacity
                          key={sellerName}
                          style={[styles.streamChip, streamSellerFilter === sellerName && styles.streamChipActive]}
                          onPress={() => setStreamSellerFilter(sellerName)}
                        >
                          <Text style={[styles.streamChipText, streamSellerFilter === sellerName && styles.streamChipTextActive]}>{sellerName}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {role === 'MERCHANT' && allKnownBatches.length > 0 && (
                  <View style={styles.streamFilterGroup}>
                    <Text style={[styles.streamFilterLabel, isDarkMode && { color: '#B4D6D9' }]}>BATCH</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.streamChipRow}>
                      <TouchableOpacity
                        style={[styles.streamChip, streamBatchFilter === 'ALL' && styles.streamChipActive]}
                        onPress={() => setStreamBatchFilter('ALL')}
                      >
                        <Text style={[styles.streamChipText, streamBatchFilter === 'ALL' && styles.streamChipTextActive]}>All Batches</Text>
                      </TouchableOpacity>
                      {allKnownBatches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.streamChip, streamBatchFilter === b.id && styles.streamChipActive]}
                          onPress={() => setStreamBatchFilter(b.id)}
                        >
                          <Text style={[styles.streamChipText, streamBatchFilter === b.id && styles.streamChipTextActive]}>{b.batchNumber}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {activeStreamFilterCount > 0 && (
                  <TouchableOpacity
                    style={styles.clearStreamFiltersBtn}
                    onPress={() => {
                      setStreamDayFilter('ALL');
                      setStreamHourFilter('ALL');
                      setStreamSellerFilter('ALL');
                      setStreamBatchFilter('ALL');
                    }}
                  >
                    <Text style={styles.clearStreamFiltersText}>Clear All Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {filteredSales.slice(0, streamVisibleCount).map(item => {
              const saleBatch = allKnownBatches.find((b) => b.id === item.batchId);
              const displayCustomer =
                item.buyerName || `CUST-${item.id.slice(0, 6).toUpperCase()}`;
              const recordedDate = new Date(item.timestamp);
              const formattedTime = !isNaN(recordedDate.getTime())
                ? recordedDate.toLocaleString('en-KE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
              return (
              <View key={item.id} style={[styles.transCard, isDarkMode && styles.transCardDark]}>
                <View style={styles.transLeft}>
                  <View style={[
                    styles.gradePill, 
                    item.grade === 'GRADE_1' ? styles.gradePillG1 : styles.gradePillG2
                  ]}>
                    <Text style={styles.gradePillText}>
                      {item.grade === 'GRADE_1' ? 'G1' : 'G2'}
                    </Text>
                  </View>
                  <View style={styles.transTextCol}>
                    <View style={styles.transCustomerBatchRow}>
                      <Text
                        style={[styles.transBuyer, isDarkMode && { color: '#FFFFFF' }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {displayCustomer}
                        {item.buyerNationalId ? ` (${item.buyerNationalId})` : ''}
                      </Text>
                      <View style={[styles.transStockChip, isDarkMode && styles.transStockChipDark]}>
                        <Text
                          style={[styles.transStockChipText, isDarkMode && { color: '#7DD3FC' }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {saleBatch?.batchNumber || 'Active Batch'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.transDetails, isDarkMode && { color: '#CFE9EC' }]} numberOfLines={1}>
                      {item.quantityNets} nets @ Ksh {item.negotiatedUnitPrice.toLocaleString()}/net
                    </Text>
                    <Text style={[styles.transMetaLine, isDarkMode && { color: '#94A3B8' }]} numberOfLines={1}>
                      By: {item.sellerName || 'Staff'}{formattedTime ? ` • ${formattedTime}` : ''}
                    </Text>
                    {item.paymentMethod === 'MPESA' && item.mpesaReceiptCode && (
                      <Text style={[styles.transDetails, { color: isDarkMode ? '#6EE7B7' : '#047857', fontWeight: '700' }]} numberOfLines={1}>
                        M-Pesa Ref: {item.mpesaReceiptCode}
                      </Text>
                    )}
                    {item.paymentMethod === 'CREDIT' && item.creditApprovalStatus && (
                      <View style={[
                        styles.streamApprovalBadge,
                        item.creditApprovalStatus === 'PENDING' && styles.streamPending,
                        item.creditApprovalStatus === 'APPROVED' && styles.streamApproved,
                        item.creditApprovalStatus === 'REJECTED' && styles.streamRejected
                      ]}>
                        <Text style={[
                          styles.streamApprovalText,
                          item.creditApprovalStatus === 'PENDING' && styles.streamPendingText,
                          item.creditApprovalStatus === 'APPROVED' && styles.streamApprovedText,
                          item.creditApprovalStatus === 'REJECTED' && styles.streamRejectedText
                        ]}>
                          {item.creditApprovalStatus === 'PENDING' ? '⏳ PENDING APPROVAL' : (item.creditApprovalStatus === 'APPROVED' ? '✅ APPROVED' : '❌ REJECTED')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.transRight}>
                  <Text style={[styles.transTotal, isDarkMode && { color: '#22D3EE' }]}>
                    Ksh {item.totalAmount.toLocaleString()}
                  </Text>
                  <View style={[
                    styles.methodBadge,
                    item.paymentMethod === 'CASH' && styles.methodCash,
                    item.paymentMethod === 'MPESA' && styles.methodMpesa,
                    item.paymentMethod === 'CREDIT' && styles.methodCredit,
                  ]}>
                    <Text style={styles.methodBadgeText}>
                      {item.paymentMethod === 'CREDIT' ? 'CREDIT' : `PAID • ${item.paymentMethod}`}
                    </Text>
                  </View>
                </View>
              </View>
              );
            })}

            {filteredSales.length > streamVisibleCount ? (
              <TouchableOpacity
                style={[styles.loadMoreStreamBtn, isDarkMode && styles.loadMoreStreamBtnDark]}
                onPress={() => setStreamVisibleCount((c) => c + 15)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-down" size={14} color={isDarkMode ? '#FDE68A' : '#0891B2'} />
                <Text style={[styles.loadMoreStreamText, isDarkMode && { color: '#FDE68A' }]}>
                  Load Earlier Sales ({filteredSales.length - streamVisibleCount} more)
                </Text>
              </TouchableOpacity>
            ) : streamVisibleCount > 8 && filteredSales.length > 8 ? (
              <TouchableOpacity
                style={[styles.loadMoreStreamBtn, isDarkMode && styles.loadMoreStreamBtnDark]}
                onPress={() => setStreamVisibleCount(8)}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-up" size={14} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
                <Text style={[styles.loadMoreStreamText, isDarkMode && { color: '#CFE9EC' }]}>
                  Show Latest 8 Sales
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
                </>
              )}

              {/* Quick Demo Reset Bar */}
              <View style={styles.demoBar}>
                <TouchableOpacity style={styles.resetBtn} onPress={handleResetData}>
                  <Ionicons name="refresh" size={13} color="#0891B2" />
                  <Text style={styles.resetBtnText}>Reload Wakulima Demo Data</Text>
                </TouchableOpacity>
              </View>
            </>
            )
          )}

          {/* TAB 2: PRODUCTS (CATALOG, BATCH CREATION & PRICE GOVERNANCE) */}
          {activeNavTab === 'catalog' && (
            <View style={{ paddingTop: 6 }}>
              <View style={styles.tabSectionHeader}>
                <Text style={[styles.tabSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                  PRODUCTS
                </Text>
                <Text style={[styles.tabSectionSubtitle, isDarkMode && { color: '#CFE9EC' }]}>
                  Master product catalog, batch creation & wholesale price governance
                </Text>
              </View>

              {/* Master Actions Bar: Add Product & Batch / Adjust Selling Prices */}
              {role === 'MERCHANT' && (
                <View style={styles.productsMasterActionBar}>
                  <TouchableOpacity
                    style={styles.addProductBtn}
                    onPress={() => {
                      setBatchModalInitialMode('add');
                      setShowBatchProduceModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.addProductBtnText}>+ Add New Product & Batch</Text>
                  </TouchableOpacity>

                  {currentBatch && (
                    <TouchableOpacity
                      style={[styles.adjustPricesQuickBtn, isDarkMode && styles.adjustPricesQuickBtnDark]}
                      onPress={() => {
                        setBatchModalInitialMode('prices');
                        setShowBatchProduceModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="options" size={15} color={isDarkMode ? '#38BDF8' : '#0891B2'} />
                      <Text style={[styles.adjustPricesQuickBtnText, isDarkMode && { color: '#38BDF8' }]}>
                        Adjust Prices
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Empty State when All Placeholders & Sample Data Removed */}
              {batchProducts.length === 0 ? (
                <View style={[styles.emptyProductsBox, isDarkMode && styles.emptyProductsBoxDark]}>
                  <View style={styles.emptyProductsIconCircle}>
                    <Ionicons name="cube-outline" size={42} color="#0891B2" />
                  </View>
                  <Text style={[styles.emptyProductsTitle, isDarkMode && styles.textWhite]}>
                    No Products in Catalog
                  </Text>
                  <Text style={[styles.emptyProductsSub, isDarkMode && { color: '#CFE9EC' }]}>
                    {role === 'MERCHANT'
                      ? 'All placeholder and sample data have been cleared. Upload a fresh product to configure packaging in KG, origin, selling prices, Grade 2 pricing, and floor minimums.'
                      : 'Awaiting Master to onboard a fresh truck product batch.'}
                  </Text>
                  {role === 'MERCHANT' && (
                    <TouchableOpacity
                      style={styles.emptyProductsUploadBtn}
                      onPress={() => {
                        setBatchModalInitialMode('add');
                        setShowBatchProduceModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyProductsUploadBtnText}>+ Upload Fresh Product for Testing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {/* Produce Origin & Batch Contents Containers (One card per active batch, newest below) */}
                  {activeBatchesList.map((batch) => {
                    const thisBatchProducts = batchProducts.filter((p) => p.batchId === batch.id);
                    return (
                    <TouchableOpacity
                      key={batch.id}
                      style={[styles.produceOriginCard, isDarkMode && styles.produceOriginCardDark]}
                      onPress={() => {
                        setSelectedBatchId(batch.id);
                        setBatchModalInitialMode('view');
                        setShowBatchProduceModal(true);
                      }}
                      activeOpacity={0.88}
                    >
                      {/* Row 1: Batch ID */}
                      <View style={styles.batchIdRow}>
                        <View
                          style={[
                            styles.produceBatchBadge,
                            isDarkMode && styles.produceBatchBadgeDark,
                          ]}
                        >
                          <Text
                            style={[
                              styles.produceBatchBadgeText,
                              isDarkMode && { color: '#FDE68A' },
                            ]}
                            numberOfLines={1}
                          >
                            {batch.batchNumber}
                          </Text>
                        </View>
                      </View>

                      {/* Row 2: Source & Delivering Truck in the same line */}
                      <View style={styles.batchSourceTruckRow}>
                        <View style={styles.batchTopOriginWrap}>
                          <Ionicons
                            name="location-outline"
                            size={13}
                            color={isDarkMode ? '#FDE68A' : '#0891B2'}
                          />
                          <Text
                            style={[
                              styles.batchTopMetaText,
                              isDarkMode && { color: '#F0FDFA' },
                            ]}
                            numberOfLines={1}
                          >
                            {formatShortOriginForBatch(batch)}
                          </Text>
                        </View>
                        <View style={styles.batchTruckWrap}>
                          <Ionicons
                            name="car-outline"
                            size={13}
                            color={isDarkMode ? '#CFE9EC' : '#475569'}
                          />
                          <Text
                            style={[
                              styles.batchTopMetaTruck,
                              isDarkMode && { color: '#CFE9EC' },
                            ]}
                            numberOfLines={1}
                          >
                            {batch.truckPlate}
                          </Text>
                        </View>
                      </View>

                      {/* Row 3: Product Images */}
                      {(() => {
                        const seen = new Set<string>();
                        const thumbs: Array<{ uri: string; tag: string }> = [];
                        for (const p of thisBatchProducts) {
                          const tag = p.grade === 'GRADE_1' ? 'G1' : 'G2';
                          const list = [p.photoUrl, ...(p.photoUrls ?? [])].filter(Boolean);
                          for (const uri of list) {
                            if (!seen.has(uri)) {
                              seen.add(uri);
                              thumbs.push({ uri, tag });
                            }
                          }
                        }
                        for (const uri of batch.photoUrls ?? []) {
                          if (uri && !seen.has(uri)) {
                            seen.add(uri);
                            thumbs.push({ uri, tag: 'BATCH' });
                          }
                        }
                        if (thumbs.length === 0) return null;
                        if (thumbs.length === 1) {
                          const single = thumbs[0];
                          return (
                            <TouchableOpacity
                              style={styles.batchSingleImageWrapper}
                              activeOpacity={0.85}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                setLightboxState({
                                  visible: true,
                                  images: [{ uri: single.uri, label: single.tag }],
                                  initialIndex: 0,
                                });
                              }}
                            >
                              <Image source={{ uri: single.uri }} style={styles.batchSingleImage} resizeMode="cover" />
                              <View style={styles.batchThumbnailBadge}>
                                <Text style={styles.batchThumbnailBadgeText}>{single.tag}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.batchThumbnailsRow}
                            contentContainerStyle={{ gap: 8 }}
                          >
                            {thumbs.map((t, idx) => (
                              <TouchableOpacity
                                key={`${t.uri}-${idx}`}
                                style={styles.batchThumbnailWrapper}
                                activeOpacity={0.85}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  setLightboxState({
                                    visible: true,
                                    images: thumbs.map((item) => ({ uri: item.uri, label: item.tag })),
                                    initialIndex: idx,
                                  });
                                }}
                              >
                                <Image source={{ uri: t.uri }} style={styles.batchThumbnailImg} resizeMode="cover" />
                                <View style={styles.batchThumbnailBadge}>
                                  <Text style={styles.batchThumbnailBadgeText}>{t.tag}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        );
                      })()}

                      {/* Row 4: Packaging, Grades & Quantity in List Form */}
                      {(() => {
                        const hasGrade2 =
                          batch.initialGrade2Nets > 0 || (batch.pricePerBagGrade2 ?? 0) > 0;
                        return (
                          <View style={[styles.batchSummaryBox, isDarkMode && styles.batchSummaryBoxDark]}>
                            <View style={[styles.batchListRow, isDarkMode && styles.batchListRowDark]}>
                              <Text style={[styles.batchListLabel, isDarkMode && { color: '#B4D6D9' }]}>
                                Packaging
                              </Text>
                              <Text style={[styles.batchListValue, isDarkMode && styles.textWhite]}>
                                {thisBatchProducts[0]?.packaging || `${batch.packagingKg ?? 20}KG NET`}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.batchListRow,
                                isDarkMode && styles.batchListRowDark,
                                !hasGrade2 && { borderBottomWidth: 0, paddingBottom: 0 },
                              ]}
                            >
                              <Text style={[styles.batchListLabel, isDarkMode && { color: '#B4D6D9' }]}>
                                Grade 1 (Ksh {batch.pricePerBagGrade1?.toLocaleString() ?? 1300})
                              </Text>
                              <Text
                                style={[
                                  styles.batchListValue,
                                  { color: isDarkMode ? '#FDE68A' : '#0891B2' },
                                ]}
                              >
                                {batch.remainingGrade1Nets} nets left
                              </Text>
                            </View>

                            {hasGrade2 && (
                              <View
                                style={[
                                  styles.batchListRow,
                                  { borderBottomWidth: 0, paddingBottom: 0 },
                                ]}
                              >
                                <Text style={[styles.batchListLabel, isDarkMode && { color: '#B4D6D9' }]}>
                                  Grade 2 (Ksh {batch.pricePerBagGrade2?.toLocaleString() ?? 1000})
                                </Text>
                                <Text
                                  style={[
                                    styles.batchListValue,
                                    { color: isDarkMode ? '#FDE68A' : '#0F766E' },
                                  ]}
                                >
                                  {batch.remainingGrade2Nets} nets left
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
          )}

          {/* TAB 3: LEDGER (BOOKKEEPING, CREDIT RECORDS & DAILY COB CLOSURES) */}
          {activeNavTab === 'credits' && (
            <View style={{ paddingTop: 6 }}>
              {role === 'SELLER' ? (
                /* Seller View: Dedicated Debtor Ledger for Today & Active Unpaid Debts */
                <View>
                  <View style={styles.tabSectionHeader}>
                    <Text style={[styles.tabSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                      ASSIGNED DEBTOR LEDGER
                    </Text>
                    <Text style={[styles.tabSectionSubtitle, isDarkMode && { color: '#CFE9EC' }]}>
                      Active credit records issued today & unpaid receivables assigned to your terminal
                    </Text>
                  </View>
                  <CreditRecordsView isDarkMode={isDarkMode} />
                </View>
              ) : (
                /* Master View: Consignment Bookkeeping, Credit Records, and 14:00 Closures */
                <View>
                  <View style={styles.tabSectionHeader}>
                    <Text style={[styles.tabSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                      MASTER LEDGER & FINANCIALS
                    </Text>
                    <Text style={[styles.tabSectionSubtitle, isDarkMode && { color: '#CFE9EC' }]}>
                      Consignment Bookkeeping • Credited Persons & Debtor Governance • 14:00 COB Closures
                    </Text>
                  </View>

                  {/* Segmented Control for Ledger Sub-Views */}
                  <View style={styles.ledgerSubTabRow}>
                <TouchableOpacity
                  style={[
                    styles.ledgerSubTabBtn,
                    ledgerSubTab === 'bookkeeping' && styles.ledgerSubTabBtnActive,
                  ]}
                  onPress={() => setLedgerSubTab('bookkeeping')}
                >
                  <Ionicons
                    name="bar-chart"
                    size={13}
                    color={ledgerSubTab === 'bookkeeping' ? '#FFFFFF' : '#0891B2'}
                  />
                  <Text
                    style={[
                      styles.ledgerSubTabBtnText,
                      ledgerSubTab === 'bookkeeping' && styles.ledgerSubTabBtnTextActive,
                    ]}
                  >
                    {role === 'MERCHANT' ? 'Master Receipt' : 'Drawers & Costs'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.ledgerSubTabBtn,
                    ledgerSubTab === 'credit_records' && styles.ledgerSubTabBtnActive,
                  ]}
                  onPress={() => setLedgerSubTab('credit_records')}
                >
                  <Ionicons
                    name="people"
                    size={13}
                    color={ledgerSubTab === 'credit_records' ? '#FFFFFF' : '#0891B2'}
                  />
                  <Text
                    style={[
                      styles.ledgerSubTabBtnText,
                      ledgerSubTab === 'credit_records' && styles.ledgerSubTabBtnTextActive,
                    ]}
                  >
                    Credit Records
                  </Text>
                  {customerCredits.length > 0 && (
                    <View
                      style={[
                        styles.subTabBadge,
                        ledgerSubTab === 'credit_records' && styles.subTabBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subTabBadgeText,
                          ledgerSubTab === 'credit_records' && styles.subTabBadgeTextActive,
                        ]}
                      >
                        {customerCredits.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.ledgerSubTabBtn,
                    ledgerSubTab === 'daily_closures' && styles.ledgerSubTabBtnActive,
                  ]}
                  onPress={() => setLedgerSubTab('daily_closures')}
                >
                  <Ionicons
                    name="receipt"
                    size={13}
                    color={ledgerSubTab === 'daily_closures' ? '#FFFFFF' : '#0891B2'}
                  />
                  <Text
                    style={[
                      styles.ledgerSubTabBtnText,
                      ledgerSubTab === 'daily_closures' && styles.ledgerSubTabBtnTextActive,
                    ]}
                  >
                    Daily Closures
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SUB-VIEW 1: BOOKKEEPING & CASH OVERHEADS */}
              {ledgerSubTab === 'bookkeeping' && (
                <View>
                  {/* Batch Filter for Ledger Receipt, Sales & Expenses */}
                  {allKnownBatches.length > 0 && (
                    <View
                      style={{
                        marginHorizontal: 14,
                        marginBottom: 12,
                        backgroundColor: isDarkMode ? '#256A71' : '#FFFFFF',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        shadowColor: isDarkMode ? '#0D2C30' : '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isDarkMode ? 0.25 : 0.06,
                        shadowRadius: 6,
                        elevation: 3,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setShowLedgerBatchFilter((prev) => !prev)}
                        style={[
                          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Ionicons name="filter" size={15} color={isDarkMode ? '#7DD3FC' : '#0891B2'} />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: isDarkMode ? '#F0FDFA' : '#0F172A' }}>
                            Batch Filter:
                          </Text>
                          <View
                            style={{
                              backgroundColor: isDarkMode ? '#1B4F55' : '#E0F2FE',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isDarkMode ? '#7DD3FC' : '#0369A1' }}>
                              {ledgerBatch ? `${ledgerBatch.batchNumber} (${ledgerBatch.truckPlate})` : 'Select Batch'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={showLedgerBatchFilter ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={isDarkMode ? '#7DD3FC' : '#0891B2'}
                        />
                      </TouchableOpacity>

                      {showLedgerBatchFilter && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? 'rgba(122, 181, 188, 0.25)' : '#E2E8F0' }}>
                          {allKnownBatches.map((b) => {
                            const isSelected = ledgerBatch?.id === b.id;
                            return (
                              <TouchableOpacity
                                key={b.id}
                                style={[
                                  styles.streamChip,
                                  isDarkMode && { backgroundColor: '#1B4F55', borderColor: '#7AB5BC' },
                                  isSelected && styles.streamChipActive,
                                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                                ]}
                                onPress={() => {
                                  setSelectedLedgerBatchId(b.id);
                                  setShowLedgerBatchFilter(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.streamChipText,
                                    isDarkMode && { color: '#CFE9EC' },
                                    isSelected && styles.streamChipTextActive,
                                  ]}
                                >
                                  {b.batchNumber} ({b.truckPlate})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Master Flowing Bookkeeping Receipt (Only for Master Account) */}
                  {role === 'MERCHANT' && (
                    <MasterBatchLedgerReceipt
                      isDarkMode={isDarkMode}
                      selectedBatchId={ledgerBatch?.id}
                      onEditMarketExpenses={() => setShowExpensesLabor(true)}
                    />
                  )}

                  {/* Today's Cash & M-Pesa Drawer */}
                  <FinancialSummaryCard
                    selectedBatchId={ledgerBatch?.id}
                    onOpenReconciliation={() => setShowReconciliation(true)}
                    onOpenExpensesModal={() => setShowExpensesLabor(true)}
                    onOpenLaborModal={() => setShowExpensesLabor(true)}
                  />

                  {/* Dispatch Report (below Today's Drawer after all figures are reviewed) */}
                  {role === 'MERCHANT' && (
                    <BatchDispatchReportCard
                      isDarkMode={isDarkMode}
                      selectedBatchId={ledgerBatch?.id}
                    />
                  )}
                </View>
              )}

              {/* SUB-VIEW 2: CREDIT RECORDS & DEBTOR GOVERNANCE */}
              {ledgerSubTab === 'credit_records' && (
                <CreditRecordsView isDarkMode={isDarkMode} />
              )}

              {/* SUB-VIEW 3: DAILY COB CLOSURES */}
              {ledgerSubTab === 'daily_closures' && (
                <View>
                  <DailyClosureReceipt isDarkMode={isDarkMode} />
                </View>
              )}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: USER PROFILE, POLICIES & ACCOUNT */}
          {activeNavTab === 'profile' && (
            <View style={{ paddingTop: 6 }}>
              <View style={styles.tabSectionHeader}>
                <Text style={[styles.tabSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                  STORE PROFILE & ACCOUNT
                </Text>
                <Text style={[styles.tabSectionSubtitle, isDarkMode && { color: '#CFE9EC' }]}>
                  Master credentials, editable name, truck stay day governance & seller team quotas
                </Text>
              </View>

              <UserProfileSection
                onOpenCreditLedger={() => {
                  setActiveNavTab('credits');
                  setLedgerSubTab('credit_records');
                }}
                onOpenSellerModal={() => {
                  const state = useAppStore.getState();
                  const hasStock = state.currentBatch && (
                    (state.currentBatch.remainingGrade1Nets || 0) > 0 || 
                    (state.currentBatch.remainingGrade2Nets || 0) > 0
                  );
                  if (!hasStock) {
                    Alert.alert(
                      '⚠️ No Stock Added',
                      'Please add stock in the Products catalog first before assigning stock to sales staff.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Go to Products', 
                          onPress: () => {
                            setActiveNavTab('catalog');
                          } 
                        }
                      ]
                    );
                    return;
                  }
                  setShowSellerManagement(true);
                }}
                onLogout={() => {
                  useAppStore.getState().logout();
                }}
                isDarkMode={isDarkMode}
              />
            </View>
          )}
        </ScrollView>

        {/* Floating Liquid Glass Bottom Navigation Dock */}
        <LiquidGlassBottomBar
          activeTab={activeNavTab}
          onTabChange={(tab) => {
            if (tab === 'sales' && role === 'MERCHANT') {
              setHasSelectedSalesBatch(false);
            }
            setActiveNavTab(tab);
          }}
          isDarkMode={isDarkMode}
          creditBadgeCount={pendingCreditRequests.length}
        />

        {/* Interactive Modals */}
        <ReconciliationModal 
          visible={showReconciliation}
          onClose={() => setShowReconciliation(false)}
        />

        <CreditLedgerModal
          visible={showCreditLedger}
          onClose={() => setShowCreditLedger(false)}
        />

        <NewBatchModal
          visible={showNewBatch}
          onClose={() => setShowNewBatch(false)}
        />

        <ExpensesLaborModal
          visible={showExpensesLabor}
          onClose={() => setShowExpensesLabor(false)}
          selectedBatchId={ledgerBatch?.id}
        />

        <SellerManagementModal
          visible={showSellerManagement}
          onClose={() => setShowSellerManagement(false)}
          onNavigateToProducts={() => setActiveNavTab('catalog')}
        />

        <AuthModal
          visible={showAuth}
          initialRole={authRole}
          onClose={() => setShowAuth(false)}
        />

        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          onNavigateToCredits={() => {
            setActiveNavTab('credits');
            setLedgerSubTab('credit_records');
          }}
          onNavigateToReconciliation={() => setShowReconciliation(true)}
          isDarkMode={isDarkMode}
        />

        {/* Batch Produce, Photos & Packaging Modal */}
        <BatchProduceModal
          visible={showBatchProduceModal}
          initialMode={batchModalInitialMode}
          batchId={selectedBatchId}
          onClose={() => setShowBatchProduceModal(false)}
          onSelectProductForSale={(prod) => {
            if (prod.batchId) {
              selectActiveBatch(prod.batchId);
            }
            setHasSelectedSalesBatch(true);
            setActiveNavTab('sales');
            setToastNotification({
              type: 'INFO',
              title: 'Selected Produce Pack',
              message: `Switched to sales logger for ${prod.title}.`,
            });
          }}
          isDarkMode={isDarkMode}
        />

        {/* Expandable Full-Screen Image Viewer */}
        <ImageLightboxModal
          visible={lightboxState.visible}
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          onClose={() => setLightboxState((prev) => ({ ...prev, visible: false }))}
        />
      </View>
    </View>
  );
}

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const { syncMasterWithClerk, restoreSellerSession } = useAppStore();
  const handledCallbackRef = React.useRef(false);

  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
    return () => registerClerkTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isLoaded || handledCallbackRef.current) return;
    if (typeof window === 'undefined') return;
    const { pathname, search, hash } = window.location;
    const isOAuthCallback =
      pathname === '/oauth-callback' ||
      search.includes('__clerk_status') ||
      search.includes('rotating_token_nonce') ||
      hash.includes('__clerk_status');
    if (!isOAuthCallback) return;

    handledCallbackRef.current = true;
    void (async () => {
      try {
        await clerk.handleRedirectCallback({});
        window.history.replaceState({}, '', '/');
      } catch (err) {
        console.error('[Clerk Web OAuth Callback] failed:', err);
      }
    })();
  }, [isLoaded, clerk]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      void syncMasterWithClerk().then((res) => {
        if (!res.success) {
          console.error('[ClerkAuthBridge] syncMasterWithClerk failed:', res.message);
        }
      });
    } else {
      void restoreSellerSession();
    }
  }, [isLoaded, isSignedIn, syncMasterWithClerk, restoreSellerSession]);

  return <>{children}</>;
}

function SellerOnlyBridge({ children }: { children: React.ReactNode }) {
  const { restoreSellerSession } = useAppStore();
  useEffect(() => {
    void restoreSellerSession();
  }, [restoreSellerSession]);
  return <>{children}</>;
}

export default function App() {
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={clerkTokenCache}>
        <ClerkAuthBridge>
          <SafeAreaProvider>
            <MainScreen />
          </SafeAreaProvider>
        </ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  return (
    <SellerOnlyBridge>
      <SafeAreaProvider>
        <MainScreen />
      </SafeAreaProvider>
    </SellerOnlyBridge>
  );
}

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
  },
  rootBackgroundDark: {
    backgroundColor: '#1D575D',
  },
  mobileShell: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    backgroundColor: THEME.colors.background,
  },
  mobileShellDark: {
    backgroundColor: '#1D575D',
  },
  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollViewDark: {
    backgroundColor: '#1D575D',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  tabSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tabSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  tabSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  ledgerSubTabRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 6,
    marginVertical: 10,
  },
  ledgerSubTabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  ledgerSubTabBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  ledgerSubTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  ledgerSubTabBtnTextActive: {
    color: '#FFFFFF',
  },
  subTabBadge: {
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 2,
  },
  subTabBadgeActive: {
    backgroundColor: '#164E63',
  },
  subTabBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0891B2',
  },
  subTabBadgeTextActive: {
    color: '#A5F3FC',
  },
  cobActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  cobActionBannerDark: {
    backgroundColor: '#256A71',
    borderColor: '#FDE68A',
    borderWidth: 0.75,
  },
  cobActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },
  cobActionSub: {
    fontSize: 10,
    color: '#0E7490',
    marginTop: 2,
  },
  runCobBtn: {
    backgroundColor: '#0891B2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  runCobBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  debtSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  debtSummaryCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  debtMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  debtMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  debtMetricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#DC2626',
    marginTop: 2,
  },
  debtorCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  debtorCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  openLedgerModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
  },
  openLedgerModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dueDaysText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '700',
  },
  transactionsSection: {
    marginHorizontal: 14,
    marginTop: 8,
  },
  transHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E7490',
    letterSpacing: 0.5,
  },
  transCountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  transCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  transLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  transTextCol: {
    flex: 1,
    minWidth: 0,
  },
  transCustomerBatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  transStockChip: {
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 1,
    maxWidth: '48%',
    minWidth: 0,
  },
  transStockChipDark: {
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
  },
  transStockChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
    flexShrink: 1,
  },
  gradePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradePillG1: {
    backgroundColor: '#0891B2', // Turquoise Blue
  },
  gradePillG2: {
    backgroundColor: '#D97706',
  },
  gradePillText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  transBuyer: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    flexShrink: 1,
    minWidth: 0,
  },
  transDetails: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  transRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  methodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  methodCash: {
    backgroundColor: '#DCFCE7',
  },
  methodMpesa: {
    backgroundColor: '#CCFBF1', // Soft Turquoise Mint
  },
  methodCredit: {
    backgroundColor: '#FEF3C7',
  },
  methodBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  demoBar: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  approvalNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 12,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    padding: 12,
  },
  approvalNoticeCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#FDE68A',
    borderWidth: 0.75,
  },
  approvalNoticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  approvalNoticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalNoticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#DC2626',
  },
  approvalSubtitle: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginBottom: 10,
  },
  pendingItemBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  pendingItemBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  pendingItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  pendingDebtorName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pendingDebtorId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
    marginTop: 2,
  },
  pendingDebtBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingDebtText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
  },
  pendingDetailsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    gap: 3,
    marginBottom: 8,
  },
  pendingStockDetail: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  pendingAuthDetail: {
    fontSize: 10.5,
    color: '#475569',
  },
  approvalButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rejectButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  streamApprovalBadge: {
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  streamPending: {
    backgroundColor: '#FEF3C7',
  },
  streamPendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  streamApproved: {
    backgroundColor: '#ECFDF5',
  },
  streamApprovedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  streamRejected: {
    backgroundColor: '#FEF2F2',
  },
  streamRejectedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  streamApprovalText: {
    fontSize: 9,
    fontWeight: '800',
  },
  salesBatchPickerSection: {
    paddingTop: 6,
    paddingBottom: 12,
  },
  streamFilterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  streamFilterToggleBtnDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
  },
  streamFilterToggleBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  streamFilterToggleText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  streamFilterPanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  streamFilterPanelDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  streamFilterGroup: {
    gap: 4,
  },
  streamFilterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  streamChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  streamChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  streamChipActive: {
    backgroundColor: '#0891B2',
  },
  streamChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  streamChipTextActive: {
    color: '#FFFFFF',
  },
  clearStreamFiltersBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearStreamFiltersText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  transMetaLine: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  loadMoreStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    marginTop: 6,
  },
  loadMoreStreamBtnDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  loadMoreStreamText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  salesBatchPickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  salesBatchPickCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.25,
  },
  switchBatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFEFF',
    borderRadius: 10,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  switchBatchBarDark: {
    backgroundColor: '#1B4F55',
  },
  switchBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  switchBatchBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  switchBatchActiveLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
  },
  // Produce Origin Card (Produce Tab)
  produceOriginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  produceOriginCardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.25,
  },
  produceOriginHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  batchSourceTruckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  batchTopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  batchTopOriginWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchTruckWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  batchTopMetaText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  batchTopMetaTruck: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  produceOriginTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  produceOriginTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.4,
  },
  produceBatchBadge: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  produceBatchBadgeDark: {
    backgroundColor: '#1B4F55',
  },
  produceBatchBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E7490',
  },
  produceOriginDetailsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  produceOriginDetailItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  produceOriginDetailItemDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  produceOriginDetailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  produceOriginDetailValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  batchContentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  batchSingleImageWrapper: {
    position: 'relative',
    width: '100%',
    height: 124,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  batchSingleImage: {
    width: '100%',
    height: '100%',
  },
  batchThumbnailsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  batchThumbnailWrapper: {
    position: 'relative',
    width: 112,
    height: 82,
    borderRadius: 10,
    overflow: 'hidden',
  },
  batchThumbnailImg: {
    width: '100%',
    height: '100%',
  },
  batchThumbnailBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  batchThumbnailBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  batchSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  batchSummaryBoxDark: {
    backgroundColor: '#1B4F55',
  },
  batchListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  batchListRowDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.25)',
  },
  batchListLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  batchListValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  batchSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  summarySubValue: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 1,
  },
  viewProduceTriggerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0891B2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  viewProduceTriggerTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewProduceTriggerSub: {
    fontSize: 9.5,
    color: '#E0F2FE',
    marginTop: 1,
  },
  viewProduceIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ledger Expenses Card (Ledger Tab)
  ledgerExpensesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  ledgerExpensesCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  ledgerExpensesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ledgerExpensesTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.4,
  },
  addExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addExpenseBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  cessBreakdownGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  cessBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cessBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  cessLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cessAmount: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  cessSubtext: {
    fontSize: 10,
    color: '#64748B',
  },
  expenseItemsList: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  expenseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  expenseItemRowDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.4)',
  },
  expenseDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  expenseCat: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  expenseAmt: {
    fontSize: 12,
    fontWeight: '800',
  },
  expenseMethod: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },

  // Products Master Action Bar & Empty State
  productsMasterActionBar: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  addProductBtn: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addProductBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  adjustPricesQuickBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0891B2',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  adjustPricesQuickBtnDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  adjustPricesQuickBtnText: {
    color: '#0891B2',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyProductsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 14,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    borderStyle: 'dashed',
  },
  emptyProductsBoxDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  emptyProductsIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFEFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyProductsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyProductsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  emptyProductsUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  emptyProductsUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

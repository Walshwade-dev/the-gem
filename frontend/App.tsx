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
import { MasterBatchLedgerReceipt } from './src/components/ui/MasterBatchLedgerReceipt';
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
    expenses,
    customerCredits,
    batchProducts,
    deleteBatchProduct,
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
      expenses: s.expenses,
      customerCredits: s.customerCredits,
      batchProducts: s.batchProducts,
      deleteBatchProduct: s.deleteBatchProduct,
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

  // Bottom Liquid Glass Navigation State & Filter Chips
  const [activeNavTab, setActiveNavTab] = useState<MainAppTab>('sales');
  const [ledgerSubTab, setLedgerSubTab] = useState<'bookkeeping' | 'credit_records' | 'daily_closures'>('bookkeeping');
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
            <>
              {/* 2. Active Truck Batch & Current Stock Card */}
              <BatchOverviewCard 
                onOpenNewBatchModal={() => {
                  setActiveNavTab('catalog');
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
              <Text style={styles.transCountBadge}>{sales.length} transactions</Text>
            </View>

            {sales.slice(0, 5).map(item => (
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
                    <Text style={[styles.transBuyer, isDarkMode && { color: '#FFFFFF' }]} numberOfLines={1}>
                      {item.buyerName || 'Market Buyer'}
                      {item.buyerNationalId ? ` (ID: ${item.buyerNationalId})` : ''}
                    </Text>
                    <Text style={[styles.transDetails, isDarkMode && { color: '#A1A1AA' }]} numberOfLines={1}>
                      {item.quantityNets} nets @ Ksh {item.negotiatedUnitPrice.toLocaleString()}
                    </Text>
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
                    <Text style={styles.methodBadgeText}>{item.paymentMethod}</Text>
                  </View>
                </View>
              </View>
            ))}
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
                    onPress={() => setShowBatchProduceModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.addProductBtnText}>+ Add New Product & Batch</Text>
                  </TouchableOpacity>

                  {currentBatch && (
                    <TouchableOpacity
                      style={[styles.adjustPricesQuickBtn, isDarkMode && styles.adjustPricesQuickBtnDark]}
                      onPress={() => setShowBatchProduceModal(true)}
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
                      onPress={() => setShowBatchProduceModal(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyProductsUploadBtnText}>+ Upload Fresh Product for Testing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {/* Produce Origin & Batch Contents Container (Clickable Parent Container) */}
                  {currentBatch && (
                    <TouchableOpacity
                      style={[styles.produceOriginCard, isDarkMode && styles.produceOriginCardDark]}
                      onPress={() => setShowBatchProduceModal(true)}
                      activeOpacity={0.88}
                    >
                      <View style={styles.produceOriginHeader}>
                        <View style={styles.produceOriginTitleRow}>
                          <Ionicons name="location" size={16} color="#0891B2" />
                          <Text style={[styles.produceOriginTitle, isDarkMode && styles.textWhite]}>
                            BATCH ORIGIN & TRACEABILITY
                          </Text>
                        </View>
                        <View style={styles.produceBatchBadge}>
                          <Text style={styles.produceBatchBadgeText}>{currentBatch.batchNumber}</Text>
                        </View>
                      </View>

                      <View style={styles.produceOriginDetailsGrid}>
                        <View style={styles.produceOriginDetailItem}>
                          <Text style={styles.produceOriginDetailLabel}>PLACE OF ORIGIN</Text>
                          <Text style={[styles.produceOriginDetailValue, isDarkMode && styles.textWhite]}>
                            {getBatchShortOrigin()}
                          </Text>
                        </View>
                        <View style={styles.produceOriginDetailItem}>
                          <Text style={styles.produceOriginDetailLabel}>HAULING TRUCK</Text>
                          <Text style={[styles.produceOriginDetailValue, isDarkMode && styles.textWhite]}>
                            {currentBatch.truckPlate}
                          </Text>
                        </View>
                      </View>

                      {/* Batch Produce Contents Stored Inside This Container */}
                      <View style={styles.batchContentsContainer}>
                        {/* Batch Images Strip */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchThumbnailsRow}>
                          {batchProducts.map((p) => (
                            <View key={p.id} style={styles.batchThumbnailWrapper}>
                              <Image source={{ uri: p.photoUrl }} style={styles.batchThumbnailImg} />
                              <View style={styles.batchThumbnailBadge}>
                                <Text style={styles.batchThumbnailBadgeText}>{p.grade === 'GRADE_1' ? 'G1' : 'G2'}</Text>
                              </View>
                            </View>
                          ))}
                        </ScrollView>

                        {/* Pricing, Packaging & Description Summary */}
                        <View style={[styles.batchSummaryBox, isDarkMode && styles.batchSummaryBoxDark]}>
                          <View style={styles.batchSummaryRow}>
                            <View style={styles.summaryItem}>
                              <Text style={styles.summaryLabel}>PACKAGE SIZE</Text>
                              <Text style={[styles.summaryValue, isDarkMode && styles.textWhite]}>
                                {batchProducts[0]?.packaging || 'Standard Nets'}
                              </Text>
                            </View>
                            <View style={styles.summaryItem}>
                              <Text style={styles.summaryLabel}>WHOLESALE PRICES</Text>
                              <Text style={[styles.summaryValue, { color: '#0891B2' }]}>
                                G1: Ksh {currentBatch.pricePerBagGrade1?.toLocaleString() ?? 1300}
                                {currentBatch.pricePerBagGrade2 ? ` • G2: Ksh ${currentBatch.pricePerBagGrade2.toLocaleString()}` : ''}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Clickable Modal Trigger Banner */}
                        <View style={styles.viewProduceTriggerBar}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.viewProduceTriggerTitle}>
                              👁️ View Products, Photos & Pricing ({batchProducts.length})
                            </Text>
                            <Text style={styles.viewProduceTriggerSub}>
                              Tap to open modal • {role === 'MERCHANT' ? 'Master upload, price shift & delete enabled' : 'Wholesale packaging and prices'}
                            </Text>
                          </View>
                          <View style={styles.viewProduceIconCircle}>
                            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  <FilterChips
                    options={produceFilterOptions}
                    selectedId={selectedProduceFilter}
                    onSelect={setSelectedProduceFilter}
                    isDarkMode={isDarkMode}
                  />

                  <View style={{ marginTop: 8 }}>
                    {filteredProduce.map((prod) => (
                      <ProduceListingCard
                        key={prod.id}
                        item={prod}
                        role={role}
                        onDeleteProduct={handleDeleteProduct}
                        onQuickLog={(item) => {
                          setActiveNavTab('sales');
                          setToastNotification({
                            type: 'INFO',
                            title: 'Selected Product',
                            message: `Switched to sales logger for ${item.title}.`,
                          });
                        }}
                        isDarkMode={isDarkMode}
                      />
                    ))}
                  </View>
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
                  {/* Master Flowing Bookkeeping Receipt (Only for Master Account) */}
                  {role === 'MERCHANT' && (
                    <MasterBatchLedgerReceipt isDarkMode={isDarkMode} />
                  )}

                  {/* Today's Cash & M-Pesa Drawer */}
                  <FinancialSummaryCard 
                    onOpenReconciliation={() => setShowReconciliation(true)}
                    onOpenExpensesModal={() => setShowExpensesLabor(true)}
                    onOpenLaborModal={() => setShowExpensesLabor(true)}
                  />

                  {/* NCC Cess & Expenses Breakdown */}
                  {currentBatch && (
                    <View style={[styles.ledgerExpensesCard, isDarkMode && styles.ledgerExpensesCardDark]}>
                      <View style={styles.ledgerExpensesHeader}>
                        <View style={styles.transTitleRow}>
                          <Ionicons name="receipt" size={16} color="#D97706" />
                          <Text style={[styles.ledgerExpensesTitle, isDarkMode && styles.textWhite]}>
                            NCC CESS & BATCH OVERHEADS
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addExpenseBtn}
                          onPress={() => setShowExpensesLabor(true)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add" size={13} color="#FFFFFF" />
                          <Text style={styles.addExpenseBtnText}>+ Expense</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.cessBreakdownGrid}>
                        <View style={[styles.cessBox, isDarkMode && styles.cessBoxDark]}>
                          <Text style={styles.cessLabel}>DAY 1 NCC CESS</Text>
                          <Text style={[styles.cessAmount, { color: '#0891B2' }]}>
                            Ksh {currentBatch.nccCessPaid.toLocaleString()}
                          </Text>
                          <Text style={styles.cessSubtext}>
                            {currentBatch.nccDeclaredNets} nets counted & covered
                          </Text>
                        </View>

                        <View style={[styles.cessBox, isDarkMode && styles.cessBoxDark]}>
                          <Text style={styles.cessLabel}>DAILY DEMURRAGE</Text>
                          <Text style={[styles.cessAmount, { color: '#D97706' }]}>
                            {currentBatch.dayNumber === 1
                              ? 'Ksh 0 (Day 1)'
                              : `Ksh ${((currentBatch.dayNumber - 1) * 1000).toLocaleString()}`}
                          </Text>
                          <Text style={styles.cessSubtext}>
                            Day {currentBatch.dayNumber} of 4 • Flat Ksh 1,000/day
                          </Text>
                        </View>
                      </View>

                      {/* Expenses list summary */}
                      {expenses.length > 0 && (
                        <View style={styles.expenseItemsList}>
                          {expenses.slice(0, 3).map((exp) => (
                            <View
                              key={exp.id}
                              style={[styles.expenseItemRow, isDarkMode && styles.expenseItemRowDark]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.expenseDesc, isDarkMode && styles.textWhite]}>
                                  {exp.description}
                                </Text>
                                <Text style={styles.expenseCat}>
                                  {exp.category === 'CLEANER' || (exp.category as string) === 'SWEEPING_AND_SANITATION'
                                    ? 'SWEEPING & SANITATION'
                                    : exp.category === 'WATCHMAN'
                                    ? 'SECURITY'
                                    : exp.category} • {exp.date}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.expenseAmt, { color: '#DC2626' }]}>
                                  -Ksh {exp.amount.toLocaleString()}
                                </Text>
                                <Text style={styles.expenseMethod}>{exp.paidVia}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
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
                  <View style={[styles.cobActionBanner, isDarkMode && styles.cobActionBannerDark]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cobActionTitle, isDarkMode && { color: '#FDE68A' }]}>
                        14:00 COB RECONCILIATION & CLOSURE
                      </Text>
                      <Text style={[styles.cobActionSub, isDarkMode && { color: '#CFE9EC' }]}>
                        Count physical stock, balance cash in hand, and transfer proceeds to Master account.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.runCobBtn}
                      onPress={() => setShowReconciliation(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="scale" size={14} color="#FFFFFF" />
                      <Text style={styles.runCobBtnText}>Run 14:00 Close</Text>
                    </TouchableOpacity>
                  </View>

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
          onTabChange={setActiveNavTab}
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
          onClose={() => setShowBatchProduceModal(false)}
          onSelectProductForSale={(prod) => {
            setActiveNavTab('sales');
            setToastNotification({
              type: 'INFO',
              title: 'Selected Produce Pack',
              message: `Switched to sales logger for ${prod.title}.`,
            });
          }}
          isDarkMode={isDarkMode}
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
  },
  transTextCol: {
    flex: 1,
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
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
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
  // Produce Origin Card (Produce Tab)
  produceOriginCard: {
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
  produceOriginCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  produceOriginHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
  batchThumbnailsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  batchThumbnailWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  batchThumbnailImg: {
    width: 68,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  batchThumbnailBadge: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: 'rgba(8, 145, 178, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  batchThumbnailBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  batchSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  batchSummaryBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  batchSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
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

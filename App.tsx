// ============================================================================
// The Gem: Onion Sales Tracker (Wakulima Market Wholesale Suite)
// Main Application Screen - Mobile-First Responsive Shell (Turquoise Blue Theme)
// ============================================================================

import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  Text, 
  TouchableOpacity,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from './src/constants/theme';
import { useAppStore } from './src/store/useAppStore';

// Components
import { Header } from './src/components/Header';
import { BatchOverviewCard } from './src/components/BatchOverviewCard';
import { SalesLogger } from './src/components/SalesLogger';
import { FinancialSummaryCard } from './src/components/FinancialSummaryCard';
import { LockdownScreen } from './src/components/LockdownScreen';

// Modals
import { ReconciliationModal } from './src/components/ReconciliationModal';
import { CreditLedgerModal } from './src/components/CreditLedgerModal';
import { NewBatchModal } from './src/components/NewBatchModal';
import { ExpensesLaborModal } from './src/components/ExpensesLaborModal';
import { SellerManagementModal } from './src/components/SellerManagementModal';
import { AuthModal } from './src/components/AuthModal';

function MainScreen() {
  const { 
    isLockedDown, 
    role, 
    sales, 
    resetToSampleData 
  } = useAppStore();

  // Modal Visibility States
  const [showReconciliation, setShowReconciliation] = useState<boolean>(false);
  const [showCreditLedger, setShowCreditLedger] = useState<boolean>(false);
  const [showNewBatch, setShowNewBatch] = useState<boolean>(false);
  const [showExpensesLabor, setShowExpensesLabor] = useState<boolean>(false);
  const [showSellerManagement, setShowSellerManagement] = useState<boolean>(false);
  const [showAuth, setShowAuth] = useState<boolean>(false);

  // If system detects breach or panic triggered, freeze entire UI
  if (isLockedDown) {
    return <LockdownScreen />;
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

  return (
    <View style={styles.rootBackground}>
      <StatusBar style="light" />
      
      {/* Mobile-First Centered Container for Responsive Display */}
      <View style={styles.mobileShell}>
        {/* 1. Brand Header & Role Switcher */}
        <Header 
          onOpenAuth={() => setShowAuth(true)}
          onOpenCreditLedger={() => setShowCreditLedger(true)}
        />

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 2. Active Truck Batch & Produce Overview Card */}
          <BatchOverviewCard 
            onOpenNewBatchModal={() => setShowNewBatch(true)}
            onOpenSellerModal={() => setShowSellerManagement(true)}
          />

          {/* 3. Financial Overview (Merchant view, or summary for Seller) */}
          {role === 'MERCHANT' && (
            <FinancialSummaryCard 
              onOpenReconciliation={() => setShowReconciliation(true)}
              onOpenExpensesModal={() => setShowExpensesLabor(true)}
              onOpenLaborModal={() => setShowExpensesLabor(true)}
            />
          )}

          {/* 4. Real-time Sales Logger (Available to both Merchant & Seller) */}
          <SalesLogger />

          {/* 5. Live Feed of Recorded Transactions */}
          <View style={styles.transactionsSection}>
            <View style={styles.transHeaderRow}>
              <View style={styles.transTitleRow}>
                <MaterialCommunityIcons name="history" size={17} color={THEME.colors.primary} />
                <Text style={styles.transTitle}>LIVE SALES STREAM (MAUZO YA SASA)</Text>
              </View>
              <Text style={styles.transCountBadge}>{sales.length} transactions</Text>
            </View>

            {sales.slice(0, 5).map(item => (
              <View key={item.id} style={styles.transCard}>
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
                    <Text style={styles.transBuyer} numberOfLines={1}>
                      {item.buyerName || 'Market Buyer'}
                    </Text>
                    <Text style={styles.transDetails} numberOfLines={1}>
                      {item.quantityNets} nets @ Ksh {item.negotiatedUnitPrice.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.transRight}>
                  <Text style={styles.transTotal}>
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

          {/* Quick Demo Reset Bar */}
          <View style={styles.demoBar}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetData}>
              <Ionicons name="refresh" size={13} color="#0891B2" />
              <Text style={styles.resetBtnText}>Reload Wakulima Demo Data</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
        />

        <AuthModal
          visible={showAuth}
          onClose={() => setShowAuth(false)}
        />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootBackground: {
    flex: 1,
    backgroundColor: '#0E7490', // Deep Turquoise shell background
    alignItems: 'center',
  },
  mobileShell: {
    flex: 1,
    width: '100%',
    maxWidth: 500, // True mobile-first ergonomic container
    backgroundColor: THEME.colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
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
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
  }
});

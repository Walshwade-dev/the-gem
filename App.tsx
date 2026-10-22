// ============================================================================
// The Gem: Onion Sales Tracker (Wakulima Market Wholesale Suite)
// Main Application Screen & Role-Based Modular Dashboard
// ============================================================================

import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  SafeAreaView, 
  Text, 
  TouchableOpacity,
  FlatList,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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

export default function App() {
  const { 
    isLockedDown, 
    role, 
    sales, 
    currentBatch,
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* 1. Brand Header & Role Switcher */}
      <Header 
        onOpenAuth={() => setShowAuth(true)}
        onOpenCreditLedger={() => setShowCreditLedger(true)}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
              <MaterialCommunityIcons name="history" size={18} color={THEME.colors.primary} />
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
                <View>
                  <Text style={styles.transBuyer}>
                    {item.buyerName || 'Market Buyer'}
                  </Text>
                  <Text style={styles.transDetails}>
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
            <Ionicons name="refresh" size={14} color="#64748B" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
  },
  scrollView: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  transactionsSection: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.sm,
  },
  transHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  transLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gradePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradePillG1: {
    backgroundColor: '#881337',
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
    backgroundColor: '#BBF7D0',
  },
  methodCredit: {
    backgroundColor: '#FEF3C7',
  },
  methodBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E293B',
  },
  demoBar: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  }
});

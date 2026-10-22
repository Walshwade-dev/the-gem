// ============================================================================
// The Gem: Real-Time Financial Overview & Drawer Summary Card
// Cash, M-Pesa, Credit (Madeni) & Reconciliation Trigger
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface FinancialSummaryCardProps {
  onOpenReconciliation: () => void;
  onOpenExpensesModal: () => void;
  onOpenLaborModal: () => void;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  onOpenReconciliation,
  onOpenExpensesModal,
  onOpenLaborModal
}) => {
  const { 
    sales, 
    expenses, 
    casualLaborers, 
    creditRepayments, 
    role 
  } = useAppStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.timestamp.startsWith(todayStr));
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const todayLabor = casualLaborers.filter(l => l.date === todayStr);
  const todayRepayments = creditRepayments.filter(r => r.timestamp.startsWith(todayStr));

  // Cash calculations
  const cashSales = todaySales
    .filter(s => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const cashRepayments = todayRepayments
    .filter(r => r.paymentMethod === 'CASH')
    .reduce((sum, r) => sum + r.amountPaid, 0);

  const cashExpenses = todayExpenses
    .filter(e => e.paidVia === 'CASH')
    .reduce((sum, e) => sum + e.amount, 0);

  const cashLabor = todayLabor
    .filter(l => l.isPaid && l.paidVia === 'CASH')
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const netCashInHand = cashSales + cashRepayments - (cashExpenses + cashLabor);

  // M-Pesa calculations
  const mpesaSales = todaySales
    .filter(s => s.paymentMethod === 'MPESA')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const mpesaRepayments = todayRepayments
    .filter(r => r.paymentMethod === 'MPESA')
    .reduce((sum, r) => sum + r.amountPaid, 0);

  const mpesaExpenses = todayExpenses
    .filter(e => e.paidVia === 'MPESA')
    .reduce((sum, e) => sum + e.amount, 0);

  const mpesaLabor = todayLabor
    .filter(l => l.isPaid && l.paidVia === 'MPESA')
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const netMpesaWallet = mpesaSales + mpesaRepayments - (mpesaExpenses + mpesaLabor);

  // Credit issued today
  const creditIssued = todaySales
    .filter(s => s.paymentMethod === 'CREDIT')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="wallet-outline" size={18} color={THEME.colors.emerald} />
          <Text style={styles.titleText}>TODAY'S CASH & M-PESA DRAWER</Text>
        </View>
        <Text style={styles.dateBadge}>{todayStr}</Text>
      </View>

      {/* Main Drawer Balances */}
      <View style={styles.balancesGrid}>
        {/* Expected Cash in Hand */}
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>EXPECTED CASH IN HAND</Text>
          <Text style={[styles.balanceAmount, { color: '#065F46' }]}>
            Ksh {netCashInHand.toLocaleString()}
          </Text>
          <Text style={styles.balanceBreakdown}>
            Sales: +{cashSales.toLocaleString()} | Debt Rec: +{cashRepayments.toLocaleString()}
          </Text>
        </View>

        {/* Expected M-Pesa Wallet */}
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>EXPECTED M-PESA WALLET</Text>
          <Text style={[styles.balanceAmount, { color: '#047857' }]}>
            Ksh {netMpesaWallet.toLocaleString()}
          </Text>
          <Text style={styles.balanceBreakdown}>
            Sales: +{mpesaSales.toLocaleString()} | Debt Rec: +{mpesaRepayments.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Credit & Expenses Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Credit Given Today</Text>
          <Text style={styles.statValue}>Ksh {creditIssued.toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={styles.statBoxAction} onPress={onOpenExpensesModal}>
          <Text style={styles.statLabel}>Expenses (Inc. 200 Fixed)</Text>
          <Text style={styles.statValueExp}>
            -Ksh {(cashExpenses + mpesaExpenses).toLocaleString()} ➔
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statBoxAction} onPress={onOpenLaborModal}>
          <Text style={styles.statLabel}>Casual Labor ({todayLabor.length})</Text>
          <Text style={styles.statValueExp}>
            -Ksh {(cashLabor + mpesaLabor).toLocaleString()} ➔
          </Text>
        </TouchableOpacity>
      </View>

      {/* 14:00 Close of Business (COB) Reconciliation Action Button */}
      {role === 'MERCHANT' && (
        <TouchableOpacity 
          style={styles.reconcileButton} 
          onPress={onOpenReconciliation}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="scale-balance" size={20} color="#FFFFFF" />
          <View>
            <Text style={styles.reconcileBtnTitle}>14:00 COB RECONCILIATION</Text>
            <Text style={styles.reconcileBtnSub}>
              Hesabu ya Siku: Reconcile Physical Bags & Cash Drawer
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E7490', // Deep Turquoise
    letterSpacing: 0.5,
  },
  dateBadge: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  balancesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  balanceItem: {
    flex: 1,
    backgroundColor: '#ECFEFF', // Soft Turquoise
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  balanceLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0E7490',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 17,
    fontWeight: '900',
  },
  balanceBreakdown: {
    fontSize: 9,
    color: '#0891B2',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBoxAction: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFF7ED',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  statValueExp: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C2410C',
    marginTop: 2,
  },
  reconcileButton: {
    backgroundColor: '#0891B2', // Vibrant Turquoise
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  reconcileBtnTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reconcileBtnSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  }
});

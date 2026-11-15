// ============================================================================
// The Gem: Real-Time Financial Overview & Drawer Summary Card
// Cash, M-Pesa, Credit (Madeni) & Reconciliation Trigger
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { THEME } from '../constants/theme';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';

interface FinancialSummaryCardProps {
  selectedBatchId?: string;
  onOpenReconciliation?: () => void;
  onOpenExpensesModal: () => void;
  onOpenLaborModal: () => void;
}

export const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  selectedBatchId,
  onOpenExpensesModal,
  onOpenLaborModal
}) => {
  const { 
    sales, 
    expenses, 
    casualLaborers, 
    creditRepayments, 
    isDarkMode 
  } = useAppStore(
    useShallow((s) => ({
      sales: s.sales,
      expenses: s.expenses,
      casualLaborers: s.casualLaborers,
      creditRepayments: s.creditRepayments,
      isDarkMode: s.isDarkMode,
    }))
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(
    s => s.timestamp.startsWith(todayStr) && (!selectedBatchId || s.batchId === selectedBatchId)
  );
  const todayExpenses = expenses.filter(
    e => e.date === todayStr && (!selectedBatchId || e.batchId === selectedBatchId)
  );
  const todayLabor = casualLaborers.filter(
    l => l.date === todayStr && (!selectedBatchId || l.batchId === selectedBatchId)
  );
  const todayRepayments = creditRepayments.filter(
    r => r.timestamp.startsWith(todayStr) && (!selectedBatchId || r.batchId === selectedBatchId)
  );

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
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <View style={styles.headerRow}>
        <Text style={[styles.titleText, isDarkMode && { color: '#F0FDFA' }]}>TODAY'S DRAWER</Text>
        <Text style={[styles.dateBadge, isDarkMode && { backgroundColor: '#256A71', color: '#CFE9EC' }]}>{todayStr}</Text>
      </View>

      {/* Drawer Elements in List Form */}
      <View style={styles.listContainer}>
        {/* Expected Cash in Hand */}
        <View style={[styles.listRow, isDarkMode && styles.listRowDark]}>
          <View style={styles.listLeft}>
            <Text style={[styles.listLabel, isDarkMode && { color: '#F0FDFA' }]}>
              Expected Cash in Hand
            </Text>
            <Text style={[styles.listSub, isDarkMode && { color: '#CFE9EC' }]}>
              Sales: +{cashSales.toLocaleString()} | Debt Rec: +{cashRepayments.toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.listValue, isDarkMode ? { color: '#6EE7B7' } : { color: '#065F46' }]}>
            Ksh {netCashInHand.toLocaleString()}
          </Text>
        </View>

        {/* Expected M-Pesa Wallet */}
        <View style={[styles.listRow, isDarkMode && styles.listRowDark]}>
          <View style={styles.listLeft}>
            <Text style={[styles.listLabel, isDarkMode && { color: '#F0FDFA' }]}>
              Expected M-Pesa Wallet
            </Text>
            <Text style={[styles.listSub, isDarkMode && { color: '#CFE9EC' }]}>
              Sales: +{mpesaSales.toLocaleString()} | Debt Rec: +{mpesaRepayments.toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.listValue, isDarkMode ? { color: '#6EE7B7' } : { color: '#047857' }]}>
            Ksh {netMpesaWallet.toLocaleString()}
          </Text>
        </View>

        {/* Credit Given Today */}
        <View style={[styles.listRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={styles.listLeft}>
            <Text style={[styles.listLabel, isDarkMode && { color: '#F0FDFA' }]}>
              Credit Given Today
            </Text>
          </View>
          <Text style={[styles.listValue, isDarkMode ? { color: '#F0FDFA' } : { color: '#B45309' }]}>
            Ksh {creditIssued.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDF7',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#1B4F55',
    shadowColor: '#0D2C30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
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
  listContainer: {
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listRowDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.25)',
  },
  listLeft: {
    flex: 1,
    paddingRight: 8,
  },
  listLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  listSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  listValue: {
    fontSize: 13,
    fontWeight: '900',
  },
});

// ============================================================================
// The Gem: Casual Labor (Vibarua) & Daily Expenses Management Modal
// Wakulima Market Fixed Overheads (Ksh 200) + Individually Negotiated Casual Labor
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  ScrollView, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { CasualLaborer, DailyExpense } from '../types';

interface ExpensesLaborModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ExpensesLaborModal: React.FC<ExpensesLaborModalProps> = ({ visible, onClose }) => {
  const { 
    expenses, 
    casualLaborers, 
    addCasualLaborer, 
    addDailyExpense, 
    markLaborerPaid 
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'LABOR' | 'EXPENSES'>('LABOR');

  // New Labor Form State
  const [workerName, setWorkerName] = useState<string>('');
  const [workerWage, setWorkerWage] = useState<string>('600');
  const [workerTask, setWorkerTask] = useState<CasualLaborer['task']>('OFFLOAD');
  const [laborPaidVia, setLaborPaidVia] = useState<'CASH' | 'MPESA'>('CASH');

  // New Expense Form State
  const [expCategory, setExpCategory] = useState<DailyExpense['category']>('MEALS');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expPaidVia, setExpPaidVia] = useState<'CASH' | 'MPESA'>('CASH');

  const handleAddWorker = () => {
    if (!workerName.trim()) {
      Alert.alert('Worker Name Required', 'Please enter the casual laborer\'s name.');
      return;
    }
    const wage = parseFloat(workerWage) || 0;
    if (wage <= 0) {
      Alert.alert('Invalid Wage', 'Please specify the agreed daily wage.');
      return;
    }

    addCasualLaborer({
      workerName: workerName.trim(),
      task: workerTask,
      agreedWage: wage,
      isPaid: true,
      paidVia: laborPaidVia
    });

    Alert.alert('Worker Added', `${workerName} registered for ${workerTask} @ Ksh ${wage} (${laborPaidVia}).`);
    setWorkerName('');
  };

  const handleAddExpense = () => {
    const amount = parseFloat(expAmount) || 0;
    if (amount <= 0 || !expDesc.trim()) {
      Alert.alert('Invalid Expense', 'Please enter description and amount.');
      return;
    }

    addDailyExpense({
      category: expCategory,
      description: expDesc.trim(),
      amount,
      paidVia: expPaidVia
    });

    Alert.alert('Expense Recorded', `Ksh ${amount} recorded under ${expCategory}.`);
    setExpDesc('');
    setExpAmount('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Mobile Bottom-Sheet Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="account-hard-hat" size={24} color="#0891B2" />
              <View>
                <Text style={styles.title}>EXPENSES & CASUAL LABOR (VIBARUA)</Text>
                <Text style={styles.subtitle}>Mandatory Overheads & Individual Negotiated Pay</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'LABOR' && styles.tabBtnActive]}
              onPress={() => setActiveTab('LABOR')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'LABOR' && styles.tabBtnTextActive]}>
                Casual Labor ({casualLaborers.length} Vibarua)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'EXPENSES' && styles.tabBtnActive]}
              onPress={() => setActiveTab('EXPENSES')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'EXPENSES' && styles.tabBtnTextActive]}>
                Daily Expenses ({expenses.length})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {activeTab === 'LABOR' ? (
              <View>
                {/* Add Labor Form */}
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>REGISTER CASUAL WORKER (VIBARUA)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 2 }]}
                      placeholder="Worker Name (e.g. Otieno)"
                      value={workerName}
                      onChangeText={setWorkerName}
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder="Wage Ksh"
                      keyboardType="numeric"
                      value={workerWage}
                      onChangeText={setWorkerWage}
                    />
                  </View>

                  {/* Task Selector */}
                  <View style={styles.taskChips}>
                    {(['OFFLOAD', 'SORTING', 'GUARD', 'SELLING_HELP'] as const).map(task => (
                      <TouchableOpacity
                        key={task}
                        style={[styles.taskChip, workerTask === task && styles.taskChipActive]}
                        onPress={() => setWorkerTask(task)}
                      >
                        <Text style={[styles.taskChipText, workerTask === task && styles.textWhite]}>
                          {task}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.addBtn} onPress={handleAddWorker}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>ADD WORKER & PAY</Text>
                  </TouchableOpacity>
                </View>

                {/* Worker List */}
                <Text style={styles.listHeader}>ACTIVE MARKET WORKERS</Text>
                {casualLaborers.map(worker => (
                  <View key={worker.id} style={styles.itemCard}>
                    <View>
                      <Text style={styles.itemName}>{worker.workerName}</Text>
                      <Text style={styles.itemTask}>Task: {worker.task}</Text>
                    </View>
                    <View style={styles.wageRow}>
                      <Text style={styles.wageText}>Ksh {worker.agreedWage}</Text>
                      <View style={[styles.paidTag, worker.isPaid ? styles.paidTagYes : styles.paidTagNo]}>
                        <Text style={styles.paidTagText}>
                          {worker.isPaid ? `PAID (${worker.paidVia})` : 'UNPAID'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                {/* Fixed Fees Reminder */}
                <View style={styles.fixedFeeBanner}>
                  <Ionicons name="information-circle" size={18} color="#92400E" />
                  <Text style={styles.fixedFeeText}>
                    Mandatory Daily Fixed Overheads: Watchman (Ksh 100) + Cleaners (Ksh 100) = Ksh 200 auto-recorded daily.
                  </Text>
                </View>

                {/* Add Expense Form */}
                <View style={styles.formBox}>
                  <Text style={styles.formTitle}>ADD OPERATIONAL EXPENSE</Text>
                  <TextInput
                    style={[styles.textInput, { marginBottom: 8 }]}
                    placeholder="Description (e.g. Chai for offloaders, Truck wash)"
                    value={expDesc}
                    onChangeText={setExpDesc}
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder="Amount Ksh"
                      keyboardType="numeric"
                      value={expAmount}
                      onChangeText={setExpAmount}
                    />
                    <TouchableOpacity 
                      style={[styles.payModeToggle, expPaidVia === 'CASH' ? styles.payModeCash : styles.payModeMpesa]}
                      onPress={() => setExpPaidVia(prev => prev === 'CASH' ? 'MPESA' : 'CASH')}
                    >
                      <Text style={styles.textWhite}>{expPaidVia}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.addBtn} onPress={handleAddExpense}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>RECORD EXPENSE</Text>
                  </TouchableOpacity>
                </View>

                {/* Expense List */}
                <Text style={styles.listHeader}>RECORDED EXPENSES TODAY</Text>
                {expenses.map(exp => (
                  <View key={exp.id} style={styles.itemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{exp.description}</Text>
                      <Text style={styles.itemTask}>Category: {exp.category}</Text>
                    </View>
                    <View style={styles.wageRow}>
                      <Text style={styles.expenseAmountText}>-Ksh {exp.amount}</Text>
                      <View style={styles.paidMethodBadge}>
                        <Text style={styles.paidMethodText}>{exp.paidVia}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: 500,
    height: '88%',
    paddingBottom: 24,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
  },
  subtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#0891B2',
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#0891B2',
    fontWeight: '800',
  },
  body: {
    padding: 16,
  },
  formBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  taskChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  taskChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  taskChipActive: {
    backgroundColor: THEME.colors.primary,
  },
  taskChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  textWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: THEME.colors.primary,
    height: 44,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  itemTask: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  wageRow: {
    alignItems: 'flex-end',
    gap: 4,
  },
  wageText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  expenseAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  paidTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidTagYes: {
    backgroundColor: '#DCFCE7',
  },
  paidTagNo: {
    backgroundColor: '#FEE2E2',
  },
  paidTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  fixedFeeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 14,
  },
  fixedFeeText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  payModeToggle: {
    width: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payModeCash: {
    backgroundColor: '#059669',
  },
  payModeMpesa: {
    backgroundColor: '#16A34A',
  },
  paidMethodBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paidMethodText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  }
});

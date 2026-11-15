// ============================================================================
// The Gem: Casual Labor (Vibarua) & Daily Expenses Management Modal
// Wakulima Market Fixed Overheads (Ksh 200) + Individually Negotiated Casual Labor
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity as RNTouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { CasualLaborer, DailyExpense } from '../types';

const TouchableOpacity: React.FC<React.ComponentProps<typeof RNTouchableOpacity>> = ({
  style,
  ...props
}) => (
  <RNTouchableOpacity
    {...props}
    style={[Platform.OS === 'web' && ({ cursor: 'pointer' } as any), style]}
  />
);

interface ExpensesLaborModalProps {
  visible: boolean;
  onClose: () => void;
  selectedBatchId?: string;
}

export const ExpensesLaborModal: React.FC<ExpensesLaborModalProps> = ({
  visible,
  onClose,
  selectedBatchId,
}) => {
  const {
    currentBatch,
    expenses,
    casualLaborers,
    addCasualLaborer,
    addDailyExpense,
    isDarkMode,
  } = useAppStore();

  const targetBatchId = selectedBatchId || currentBatch?.id || '';
  const batchLaborers = targetBatchId
    ? casualLaborers.filter((l) => l.batchId === targetBatchId)
    : casualLaborers;
  const batchExpenses = targetBatchId
    ? expenses.filter((e) => e.batchId === targetBatchId)
    : expenses;

  const [activeTab, setActiveTab] = useState<'LABOR' | 'EXPENSES'>('LABOR');
  const [switchWidth, setSwitchWidth] = useState<number>(0);
  const switchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(switchAnim, {
      toValue: activeTab === 'LABOR' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, switchAnim]);

  // New Labor Form State
  const [workerName, setWorkerName] = useState<string>('');
  const [workerWage, setWorkerWage] = useState<string>('600');
  const [workerTask, setWorkerTask] = useState<CasualLaborer['task']>('OFFLOAD');
  const [laborPaidVia, setLaborPaidVia] = useState<'CASH' | 'MPESA'>('CASH');

  // New Expense Form State
  const [expCategory, setExpCategory] = useState<DailyExpense['category']>('OTHER');
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
      batchId: targetBatchId || undefined,
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
      batchId: targetBatchId || undefined,
      category: expCategory,
      description: expDesc.trim(),
      amount,
      paidVia: expPaidVia
    });

    Alert.alert('Expense Recorded', `Ksh ${amount} recorded under ${expCategory}.`);
    setExpDesc('');
    setExpAmount('');
  };

  const isNccExp = (e: DailyExpense) => {
    const desc = e.description.toLowerCase();
    return (
      (e.category as string) === 'NCC_CESS' ||
      e.category === 'DEMURRAGE' ||
      (e.category as string) === 'COUNTY_CESS' ||
      desc.includes('ncc') ||
      desc.includes('cess') ||
      desc.includes('demurrage')
    );
  };
  const isSecurityExp = (e: DailyExpense) => {
    const desc = e.description.toLowerCase();
    return e.category === 'WATCHMAN' || desc.includes('watchman') || desc.includes('security');
  };
  const isSweeperExp = (e: DailyExpense) => {
    const desc = e.description.toLowerCase();
    return (
      e.category === 'CLEANER' ||
      (e.category as string) === 'SWEEPING_AND_SANITATION' ||
      desc.includes('clean') ||
      desc.includes('sweep') ||
      desc.includes('sanitation')
    );
  };

  const securityExpensesList = batchExpenses.filter((e) => !isNccExp(e) && isSecurityExp(e));
  const sweeperExpensesList = batchExpenses.filter((e) => !isNccExp(e) && !isSecurityExp(e) && isSweeperExp(e));
  const nccExpensesList = batchExpenses.filter(isNccExp);
  const otherExpensesList = batchExpenses.filter((e) => !isNccExp(e) && !isSecurityExp(e) && !isSweeperExp(e));

  const expenseGroups = [
    { key: 'SECURITY', label: 'Security Watchman', items: securityExpensesList },
    { key: 'SWEEPER', label: 'Sweeping & Sanitation (Sweeper)', items: sweeperExpensesList },
    { key: 'NCC', label: 'NCC Daily Expense', items: nccExpensesList },
    { key: 'OTHER', label: 'Other Expenses', items: otherExpensesList },
  ];

  const expenseCategoryOptions: { label: string; value: DailyExpense['category'] }[] = [
    { label: 'Security', value: 'WATCHMAN' },
    { label: 'Sweeper', value: 'CLEANER' },
    { label: 'NCC Daily', value: 'NCC_CESS' },
    { label: 'Other', value: 'OTHER' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Mobile Bottom-Sheet Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, isDarkMode && { backgroundColor: '#7AB5BC' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, isDarkMode && { color: '#F0FDFA' }]}>
                Expenses and Labour
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#CFE9EC' : THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Segmented Switch (mimicking Login role switch with smooth sliding pill) */}
            <View
              style={[styles.switchTrack, isDarkMode && styles.switchTrackDark]}
              onLayout={(e) => setSwitchWidth(e.nativeEvent.layout.width)}
            >
              {switchWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.switchActivePill,
                    {
                      width: (switchWidth - 10) / 2,
                      backgroundColor: activeTab === 'LABOR' ? '#0891B2' : '#059669',
                      transform: [
                        {
                          translateX: switchAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, (switchWidth - 10) / 2 + 4],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => setActiveTab('LABOR')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchBtnText,
                    isDarkMode && { color: '#CFE9EC' },
                    activeTab === 'LABOR' && styles.textWhite,
                  ]}
                >
                  Casual Labour ({batchLaborers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => setActiveTab('EXPENSES')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.switchBtnText,
                    isDarkMode && { color: '#CFE9EC' },
                    activeTab === 'EXPENSES' && styles.textWhite,
                  ]}
                >
                  Daily Expenses ({batchExpenses.length})
                </Text>
              </TouchableOpacity>
            </View>
            {activeTab === 'LABOR' ? (
              <View>
                {/* Add Labor Form */}
                <View style={[styles.formBox, isDarkMode && styles.formBoxDark]}>
                  <Text style={[styles.formTitle, isDarkMode && { color: '#7DD3FC' }]}>
                    REGISTER CASUAL WORKER
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, isDarkMode && styles.textInputDark, { flex: 2 }]}
                      placeholder="Worker Name (e.g. Otieno)"
                      placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                      value={workerName}
                      onChangeText={setWorkerName}
                    />
                    <TextInput
                      style={[styles.textInput, isDarkMode && styles.textInputDark, { flex: 1 }]}
                      placeholder="Wage Ksh"
                      placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                      keyboardType="decimal-pad"
                      value={workerWage}
                      onChangeText={setWorkerWage}
                    />
                  </View>

                  {/* Task Selector */}
                  <View style={styles.taskChips}>
                    {(['OFFLOAD', 'SORTING', 'GUARD', 'SELLING_HELP'] as const).map((task) => (
                      <TouchableOpacity
                        key={task}
                        style={[
                          styles.taskChip,
                          isDarkMode && styles.taskChipDark,
                          workerTask === task && (isDarkMode ? styles.taskChipActiveDark : styles.taskChipActive),
                        ]}
                        onPress={() => setWorkerTask(task)}
                      >
                        <Text
                          style={[
                            styles.taskChipText,
                            isDarkMode && { color: '#E2F5F7' },
                            workerTask === task && styles.textWhite,
                          ]}
                        >
                          {task}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.addBtn, isDarkMode && { backgroundColor: '#059669' }]}
                    onPress={handleAddWorker}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>ADD WORKER & PAY</Text>
                  </TouchableOpacity>
                </View>

                {/* Worker List */}
                <Text style={[styles.listHeader, isDarkMode && { color: '#CFE9EC' }]}>
                  ACTIVE MARKET WORKERS
                </Text>
                {batchLaborers.length === 0 ? (
                  <Text style={[styles.emptyGroupText, isDarkMode && { color: '#B4D6D9' }]}>
                    No casual workers recorded for this batch.
                  </Text>
                ) : (
                  batchLaborers.map((worker) => (
                    <View key={worker.id} style={[styles.itemCard, isDarkMode && styles.itemCardDark]}>
                      <View>
                        <Text style={[styles.itemName, isDarkMode && { color: '#F0FDFA' }]}>
                          {worker.workerName}
                        </Text>
                        <Text style={[styles.itemTask, isDarkMode && { color: '#B4D6D9' }]}>
                          Task: {worker.task}
                        </Text>
                      </View>
                      <View style={styles.wageRow}>
                        <Text style={[styles.wageText, isDarkMode && { color: '#6EE7B7' }]}>
                          Ksh {worker.agreedWage.toLocaleString()}
                        </Text>
                        <View style={[styles.paidTag, worker.isPaid ? styles.paidTagYes : styles.paidTagNo]}>
                          <Text style={styles.paidTagText}>
                            {worker.isPaid ? `PAID (${worker.paidVia})` : 'UNPAID'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View>
                {/* Add Expense Form */}
                <View style={[styles.formBox, isDarkMode && styles.formBoxDark]}>
                  <Text style={[styles.formTitle, isDarkMode && { color: '#7DD3FC' }]}>
                    ADD MARKET EXPENSE
                  </Text>

                  {/* Category Selector */}
                  <View style={styles.taskChips}>
                    {expenseCategoryOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.taskChip,
                          isDarkMode && styles.taskChipDark,
                          expCategory === opt.value && (isDarkMode ? styles.taskChipActiveDark : styles.taskChipActive),
                        ]}
                        onPress={() => setExpCategory(opt.value)}
                      >
                        <Text
                          style={[
                            styles.taskChipText,
                            isDarkMode && { color: '#E2F5F7' },
                            expCategory === opt.value && styles.textWhite,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[styles.textInput, isDarkMode && styles.textInputDark, { marginBottom: 8 }]}
                    placeholder="Description (e.g. Night watchman, Sweeper, NCC fee)"
                    placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                    value={expDesc}
                    onChangeText={setExpDesc}
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, isDarkMode && styles.textInputDark, { flex: 1 }]}
                      placeholder="Amount Ksh"
                      placeholderTextColor={isDarkMode ? '#B4D6D9' : '#94A3B8'}
                      keyboardType="decimal-pad"
                      value={expAmount}
                      onChangeText={setExpAmount}
                    />
                    <TouchableOpacity
                      style={[styles.payModeToggle, expPaidVia === 'CASH' ? styles.payModeCash : styles.payModeMpesa]}
                      onPress={() => setExpPaidVia((prev) => (prev === 'CASH' ? 'MPESA' : 'CASH'))}
                    >
                      <Text style={styles.textWhite}>{expPaidVia}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.addBtn, isDarkMode && { backgroundColor: '#059669' }]}
                    onPress={handleAddExpense}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addBtnText}>RECORD EXPENSE</Text>
                  </TouchableOpacity>
                </View>

                {/* Recorded Expenses Separated by Type */}
                <Text style={[styles.listHeader, isDarkMode && { color: '#CFE9EC' }]}>
                  RECORDED EXPENSES
                </Text>

                {expenseGroups.map((group) => {
                  const groupTotal = group.items.reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <View key={group.key} style={[styles.expenseGroupSection, isDarkMode && styles.expenseGroupSectionDark]}>
                      <View style={styles.expenseGroupHeader}>
                        <Text style={[styles.expenseGroupTitle, isDarkMode && { color: '#7DD3FC' }]}>
                          {group.label}
                        </Text>
                        <Text style={[styles.expenseGroupTotal, isDarkMode && { color: '#F0FDFA' }]}>
                          Ksh {groupTotal.toLocaleString()}
                        </Text>
                      </View>

                      {group.items.length === 0 ? (
                        <Text style={[styles.emptyGroupText, isDarkMode && { color: '#B4D6D9' }]}>
                          No {group.label.toLowerCase()} recorded yet.
                        </Text>
                      ) : (
                        group.items.map((exp) => (
                          <View key={exp.id} style={[styles.itemCard, isDarkMode && styles.itemCardDark]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.itemName, isDarkMode && { color: '#F0FDFA' }]}>
                                {exp.description}
                              </Text>
                              <Text style={[styles.itemTask, isDarkMode && { color: '#B4D6D9' }]}>
                                {exp.date}
                              </Text>
                            </View>
                            <View style={styles.wageRow}>
                              <Text style={[styles.expenseAmountText, isDarkMode && { color: '#FCA5A5' }]}>
                                -Ksh {exp.amount.toLocaleString()}
                              </Text>
                              <View style={[styles.paidMethodBadge, isDarkMode && { backgroundColor: '#256A71' }]}>
                                <Text style={[styles.paidMethodText, isDarkMode && { color: '#CFE9EC' }]}>
                                  {exp.paidVia}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
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
  modalCardDark: {
    backgroundColor: '#256A71',
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
  headerDark: {
    borderBottomColor: 'rgba(122, 181, 188, 0.25)',
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
  switchTrack: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginBottom: 14,
  },
  switchTrackDark: {
    backgroundColor: '#1B4F55',
  },
  switchActivePill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 8,
  },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1,
  },
  switchBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  body: {
    padding: 16,
  },
  formBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formBoxDark: {
    backgroundColor: '#1D575D',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.22,
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
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
  textInputDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
  },
  taskChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  taskChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  taskChipDark: {
    backgroundColor: '#1B4F55',
    borderWidth: 1,
    borderColor: '#7AB5BC',
  },
  taskChipActive: {
    backgroundColor: '#0891B2',
  },
  taskChipActiveDark: {
    backgroundColor: '#0891B2',
    borderColor: '#7DD3FC',
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardDark: {
    backgroundColor: '#1B4F55',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.2,
  },
  expenseGroupSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  expenseGroupSectionDark: {
    backgroundColor: '#1D575D',
  },
  expenseGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expenseGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },
  expenseGroupTotal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyGroupText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
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

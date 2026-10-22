// ============================================================================
// The Gem: 14:00 PM Close of Business (COB) Reconciliation Modal
// Hesabu ya Siku: Physical Sack Audit vs Expected, Cash & M-Pesa Drawer Reconciliation
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

interface ReconciliationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({ visible, onClose }) => {
  const { currentBatch, performCobReconciliation } = useAppStore();

  const [physicalG1, setPhysicalG1] = useState<string>(
    currentBatch ? currentBatch.remainingGrade1Nets.toString() : '0'
  );
  const [physicalG2, setPhysicalG2] = useState<string>(
    currentBatch ? currentBatch.remainingGrade2Nets.toString() : '0'
  );
  const [actualCash, setActualCash] = useState<string>('71500'); // prefilled sample
  const [notes, setNotes] = useState<string>('');

  if (!currentBatch) return null;

  const countG1 = parseInt(physicalG1) || 0;
  const countG2 = parseInt(physicalG2) || 0;
  const cashCounted = parseFloat(actualCash) || 0;

  const handleSealReconciliation = () => {
    const rec = performCobReconciliation({
      physicalCountGrade1: countG1,
      physicalCountGrade2: countG2,
      actualCashInHand: cashCounted,
      notes: notes.trim() || undefined
    });

    if (rec) {
      Alert.alert(
        'Reconciliation Sealed (Hesabu Imefungwa)',
        `Status: ${rec.status}\n\n• Physical G1: ${rec.physicalCountGrade1} nets (Variance: ${rec.varianceGrade1})\n• Physical G2: ${rec.physicalCountGrade2} nets (Variance: ${rec.varianceGrade2})\n• Cash Discrepancy: Ksh ${rec.cashDiscrepancy.toLocaleString()}\n• Expected M-Pesa: Ksh ${rec.expectedMpesaWallet.toLocaleString()}`,
        [{ text: 'Close', onPress: onClose }]
      );
    }
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
              <MaterialCommunityIcons name="scale-balance" size={24} color="#0891B2" />
              <View>
                <Text style={styles.title}>14:00 COB RECONCILIATION</Text>
                <Text style={styles.subtitle}>Wakulima Market End-of-Day Close (Hesabu ya Siku)</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Step 1: Physical Stock Count */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={styles.stepTitle}>PHYSICAL SACK COUNT ON TRUCK</Text>
              </View>
              <Text style={styles.stepDesc}>
                Physically count the remaining nets on the truck and bay:
              </Text>

              <View style={styles.inputGrid}>
                {/* Grade 1 */}
                <View style={styles.inputBox}>
                  <Text style={styles.inputLabel}>Grade 1 (Kubwa)</Text>
                  <Text style={styles.expectedHint}>
                    System Expected: {currentBatch.remainingGrade1Nets} nets
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={physicalG1}
                    onChangeText={setPhysicalG1}
                  />
                  {countG1 !== currentBatch.remainingGrade1Nets && (
                    <Text style={[styles.varianceText, countG1 < currentBatch.remainingGrade1Nets ? styles.varianceNeg : styles.variancePos]}>
                      Variance: {countG1 - currentBatch.remainingGrade1Nets} nets
                    </Text>
                  )}
                </View>

                {/* Grade 2 */}
                <View style={styles.inputBox}>
                  <Text style={styles.inputLabel}>Grade 2 (Ndogo)</Text>
                  <Text style={styles.expectedHint}>
                    System Expected: {currentBatch.remainingGrade2Nets} nets
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={physicalG2}
                    onChangeText={setPhysicalG2}
                  />
                  {countG2 !== currentBatch.remainingGrade2Nets && (
                    <Text style={[styles.varianceText, countG2 < currentBatch.remainingGrade2Nets ? styles.varianceNeg : styles.variancePos]}>
                      Variance: {countG2 - currentBatch.remainingGrade2Nets} nets
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Step 2: Cash Drawer Audit */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepTitle}>ACTUAL CASH COUNTED IN DRAWER</Text>
              </View>
              <Text style={styles.stepDesc}>
                Count physical banknotes in hand (excluding M-Pesa):
              </Text>

              <View style={styles.cashInputRow}>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>KSH</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  keyboardType="numeric"
                  value={actualCash}
                  onChangeText={setActualCash}
                  placeholder="e.g. 71500"
                />
              </View>
            </View>

            {/* Step 3: Observations & Spoilage Notes */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepTitle}>CLOSING NOTES / SPOILAGE LOG</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="e.g., 1 net G2 had moisture rot, discarded at market compost."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.sealButton} 
              onPress={handleSealReconciliation}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
              <Text style={styles.sealButtonText}>SEAL RECONCILIATION & SAVE</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '92%',
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
    gap: 10,
  },
  title: {
    fontSize: 13.5,
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
  body: {
    padding: 16,
  },
  stepSection: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0891B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  stepDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inputBox: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  expectedHint: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  varianceText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  varianceNeg: {
    color: '#DC2626',
  },
  variancePos: {
    color: '#059669',
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  notesInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  sealButton: {
    backgroundColor: '#059669',
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sealButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  }
});

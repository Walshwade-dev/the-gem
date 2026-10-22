// ============================================================================
// The Gem: Hired Seller Delegation & Stock Quota Allocation Modal
// Sets Opening Quota, Expected Prices & Monitors Real-Time Seller Performance
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

interface SellerManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SellerManagementModal: React.FC<SellerManagementModalProps> = ({ visible, onClose }) => {
  const { currentBatch, allocations, allocateStockToSeller } = useAppStore();

  const [sellerName, setSellerName] = useState<string>('Juma (Sales Assistant)');
  const [g1Allocated, setG1Allocated] = useState<string>('40');
  const [g2Allocated, setG2Allocated] = useState<string>('20');
  const [g1TargetPrice, setG1TargetPrice] = useState<string>('2600');
  const [g2TargetPrice, setG2TargetPrice] = useState<string>('2100');

  if (!currentBatch) return null;

  const handleAllocate = () => {
    if (!sellerName.trim()) {
      Alert.alert('Seller Name Required', 'Please enter sales agent name.');
      return;
    }
    const g1 = parseInt(g1Allocated) || 0;
    const g2 = parseInt(g2Allocated) || 0;
    const p1 = parseFloat(g1TargetPrice) || 0;
    const p2 = parseFloat(g2TargetPrice) || 0;

    if (g1 > currentBatch.remainingGrade1Nets || g2 > currentBatch.remainingGrade2Nets) {
      Alert.alert('Quota Exceeds Remaining Stock', 'You cannot allocate more than the remaining stock at the bay.');
      return;
    }

    allocateStockToSeller({
      sellerId: `usr-seller-${Date.now()}`,
      sellerName: sellerName.trim(),
      grade1Allocated: g1,
      grade2Allocated: g2,
      expectedPriceG1: p1,
      expectedPriceG2: p2,
    });

    Alert.alert(
      'Stock Allocated to Seller',
      `${sellerName} assigned ${g1} G1 nets (Target Ksh ${p1}) & ${g2} G2 nets (Target Ksh ${p2}).\nSeller can now log in and sell in real time!`
    );
    onClose();
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
              <MaterialCommunityIcons name="account-tie" size={24} color="#0891B2" />
              <View>
                <Text style={styles.title}>HIRED SELLER DELEGATION</Text>
                <Text style={styles.subtitle}>Set Opening Quota & Target Prices for Sales Staff</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Form */}
            <View style={styles.formBox}>
              <Text style={styles.formTitle}>NEW SELLER QUOTA ASSIGNMENT</Text>
              
              <Text style={styles.label}>SELLER / AGENT NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Juma or Brian"
                value={sellerName}
                onChangeText={setSellerName}
              />

              {/* Grade 1 Allocation & Target Price */}
              <View style={styles.row}>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.label}>GRADE 1 NETS QUOTA</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={g1Allocated}
                    onChangeText={setG1Allocated}
                  />
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.label}>EXPECTED G1 PRICE (KSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={g1TargetPrice}
                    onChangeText={setG1TargetPrice}
                  />
                </View>
              </View>

              {/* Grade 2 Allocation & Target Price */}
              <View style={styles.row}>
                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.label}>GRADE 2 NETS QUOTA</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={g2Allocated}
                    onChangeText={setG2Allocated}
                  />
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <Text style={styles.label}>EXPECTED G2 PRICE (KSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={g2TargetPrice}
                    onChangeText={setG2TargetPrice}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.assignBtn} onPress={handleAllocate}>
                <Ionicons name="person-add" size={18} color="#FFFFFF" />
                <Text style={styles.assignBtnText}>ASSIGN STOCK & ACTIVATE SELLER</Text>
              </TouchableOpacity>
            </View>

            {/* Existing Allocations */}
            <Text style={styles.listHeader}>ACTIVE SELLER ALLOCATIONS</Text>
            {allocations.map(alloc => (
              <View key={alloc.id} style={styles.allocCard}>
                <View style={styles.allocHeader}>
                  <Text style={styles.allocName}>{alloc.sellerName}</Text>
                  <Text style={styles.allocDate}>{alloc.date}</Text>
                </View>

                <View style={styles.allocGrid}>
                  <View style={styles.allocStat}>
                    <Text style={styles.allocStatLabel}>Grade 1 Quota</Text>
                    <Text style={styles.allocStatVal}>
                      {alloc.grade1Sold} / {alloc.grade1Allocated} nets
                    </Text>
                    <Text style={styles.allocPrice}>Target: Ksh {alloc.expectedPriceG1}</Text>
                  </View>

                  <View style={styles.allocStat}>
                    <Text style={styles.allocStatLabel}>Grade 2 Quota</Text>
                    <Text style={styles.allocStatVal}>
                      {alloc.grade2Sold} / {alloc.grade2Allocated} nets
                    </Text>
                    <Text style={styles.allocPrice}>Target: Ksh {alloc.expectedPriceG2}</Text>
                  </View>
                </View>
              </View>
            ))}
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
    color: '#0891B2',
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {},
  assignBtn: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  listHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  allocCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  allocName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  allocDate: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  allocGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  allocStat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  allocStatLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  allocStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  allocPrice: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  }
});

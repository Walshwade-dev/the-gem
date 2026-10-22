// ============================================================================
// The Gem: Arriving Truck Onboarding Modal (05:00 AM Wakulima Market)
// Hierarchical Origin Picker (Merchant Only), NCC Cess Count, Opening Stock & Photos
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
import { PRESET_ORIGIN_REGIONS } from '../types/regions';

interface NewBatchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NewBatchModal: React.FC<NewBatchModalProps> = ({ visible, onClose }) => {
  const { createBatch } = useAppStore();

  const [truckPlate, setTruckPlate] = useState<string>('KDG 582C');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('TZ-NORTH');
  const [specificLocation, setSpecificLocation] = useState<string>('Singida - Iramba Plains');
  const [qualityNotes, setQualityNotes] = useState<string>('Deep crimson skin, dry papery layers, uniform bulb size.');
  const [nccBags, setNccBags] = useState<string>('240');
  const [nccCess, setNccCess] = useState<string>('16800'); // 240 * 70 Ksh
  const [initialG1, setInitialG1] = useState<string>('170');
  const [initialG2, setInitialG2] = useState<string>('70');

  const selectedRegion = PRESET_ORIGIN_REGIONS.find(r => r.regionId === selectedRegionId) || PRESET_ORIGIN_REGIONS[0];

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegionId(regionId);
    const reg = PRESET_ORIGIN_REGIONS.find(r => r.regionId === regionId);
    if (reg && reg.suggestedDistricts.length > 0) {
      setSpecificLocation(reg.suggestedDistricts[0]);
    }
  };

  const handleNccCountChange = (val: string) => {
    setNccBags(val);
    const num = parseInt(val) || 0;
    setNccCess((num * 70).toString()); // County cess rate ~70 Ksh / bag
  };

  const handleSubmit = () => {
    if (!truckPlate.trim()) {
      Alert.alert('Missing Field', 'Please enter truck registration number.');
      return;
    }
    const g1 = parseInt(initialG1) || 0;
    const g2 = parseInt(initialG2) || 0;
    const ncc = parseInt(nccBags) || 0;
    const cess = parseFloat(nccCess) || 0;

    if (g1 + g2 <= 0) {
      Alert.alert('Opening Stock Required', 'Please declare Grade 1 and Grade 2 opening stock count.');
      return;
    }

    createBatch({
      truckPlate: truckPlate.trim(),
      origin: {
        regionId: selectedRegion.regionId,
        regionName: selectedRegion.regionName,
        specificLocation: specificLocation.trim(),
        farmerSupplierNotes: qualityNotes.trim() || undefined
      },
      nccDeclaredNets: ncc,
      nccCessPaid: cess,
      initialGrade1Nets: g1,
      initialGrade2Nets: g2,
      photoUrls: [
        'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=800&auto=format&fit=crop&q=80'
      ],
      qualityNotes: qualityNotes.trim()
    });

    Alert.alert(
      '✅ Truck Registered',
      `Truck ${truckPlate} registered at Wakulima Market.\nOpening Stock: ${g1 + g2} nets (${g1} G1, ${g2} G2).\nFixed daily fees (Watchman Ksh 100 + Cleaners Ksh 100) automatically initialised.`
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
              <MaterialCommunityIcons name="truck-delivery" size={24} color="#0891B2" />
              <View>
                <Text style={styles.title}>REGISTER ARRIVING TRUCK (05:00 AM)</Text>
                <Text style={styles.subtitle}>Wakulima Market Municipal Entry & Opening Stock</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Truck Plate */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>TRUCK REGISTRATION NUMBER</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. KDE 421B"
                value={truckPlate}
                onChangeText={setTruckPlate}
                autoCapitalize="characters"
              />
            </View>

            {/* Hierarchical Region Picker (Merchant View Only) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>1. SELECT REGION OF ORIGIN (PRODUCE SOURCE)</Text>
              <Text style={styles.helperText}>
                Tracks regional performance, spoilage rates, and market uptake.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
                {PRESET_ORIGIN_REGIONS.map(reg => (
                  <TouchableOpacity
                    key={reg.regionId}
                    style={[
                      styles.regionChip,
                      selectedRegionId === reg.regionId && styles.regionChipActive
                    ]}
                    onPress={() => handleRegionSelect(reg.regionId)}
                  >
                    <Text style={[
                      styles.regionChipText,
                      selectedRegionId === reg.regionId && styles.textWhite
                    ]}>
                      {reg.regionName.split('(')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Specific Farm / Locality within selected region */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>2. SPECIFIC FARM / LOCALITY IN {selectedRegion.regionName.toUpperCase()}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Rom Farm Section 4 / Suswa Junction"
                value={specificLocation}
                onChangeText={setSpecificLocation}
              />
            </View>

            {/* Quality Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PRODUCE QUALITY & CURING OBSERVATIONS</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="e.g. Dry skin, good bulb size, harvested 5 days ago."
                value={qualityNotes}
                onChangeText={setQualityNotes}
                multiline
              />
            </View>

            {/* NCC Count & Cess */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>NCC INSPECTOR BAG COUNT</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={nccBags}
                  onChangeText={handleNccCountChange}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>COUNTY CESS FEE (KSH)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={nccCess}
                  onChangeText={setNccCess}
                />
              </View>
            </View>

            {/* Opening Stock: Grade 1 vs Grade 2 */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>GRADE 1 NETS (KUBWA)</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: '#0891B2', borderWidth: 2 }]}
                  keyboardType="numeric"
                  value={initialG1}
                  onChangeText={setInitialG1}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>GRADE 2 NETS (NDOGO)</Text>
                <TextInput
                  style={[styles.textInput, { borderColor: '#D97706', borderWidth: 2 }]}
                  keyboardType="numeric"
                  value={initialG2}
                  onChangeText={setInitialG2}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>CONFIRM TRUCK ONBOARDING</Text>
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
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 18,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  regionScroll: {
    flexDirection: 'row',
  },
  regionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  regionChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  submitBtn: {
    backgroundColor: THEME.colors.primary,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  }
});

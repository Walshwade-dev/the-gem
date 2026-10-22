// ============================================================================
// The Gem: Security Lockdown & Emergency Tamper Screen
// Freezes Application During Security Breach Until Master Admin Clears It
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

export const LockdownScreen: React.FC = () => {
  const { lockdownReason, unlock } = useAppStore();
  const [masterKey, setMasterKey] = useState<string>('');

  const handleUnlock = () => {
    if (!masterKey.trim()) {
      Alert.alert('Key Required', 'Please enter the Master Admin Recovery Key.');
      return;
    }

    const res = unlock(masterKey.trim());
    if (res.success) {
      Alert.alert('Lockdown Cleared', res.message);
      setMasterKey('');
    } else {
      Alert.alert('Access Denied', res.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Warning Shield Icon */}
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="shield-alert" size={56} color="#EF4444" />
      </View>

      <Text style={styles.title}>SYSTEM LOCKED DOWN</Text>
      <Text style={styles.subtitle}>
        Security tamper detection triggered. All active seller sessions have been revoked and data is encrypted.
      </Text>

      {/* Reason Box */}
      <View style={styles.reasonCard}>
        <Ionicons name="information-circle" size={18} color="#F87171" />
        <Text style={styles.reasonText}>
          {lockdownReason || 'Unauthorized activity or security panic triggered.'}
        </Text>
      </View>

      {/* Unlock Form */}
      <View style={styles.formContainer}>
        <Text style={styles.inputLabel}>ENTER MASTER ADMIN RECOVERY KEY</Text>
        <TextInput
          style={styles.keyInput}
          placeholder="e.g. MARIKITI-999-SECURE"
          placeholderTextColor="#7F1D1D"
          value={masterKey}
          onChangeText={setMasterKey}
          secureTextEntry
        />
        <Text style={styles.devHint}>
          Dev Master Key: <Text style={styles.devHintBold}>MARIKITI-999-SECURE</Text>
        </Text>

        <TouchableOpacity 
          style={styles.unlockButton} 
          onPress={handleUnlock}
          activeOpacity={0.8}
        >
          <Ionicons name="key" size={18} color="#FFFFFF" />
          <Text style={styles.unlockButtonText}>UNLOCK & RESTORE SYSTEM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#450A0A', // Deep dark red emergency screen
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FEE2E2',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(127, 29, 29, 0.5)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#991B1B',
    marginBottom: 24,
    width: '100%',
  },
  reasonText: {
    fontSize: 12,
    color: '#FECDD3',
    fontWeight: '600',
    flex: 1,
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  keyInput: {
    backgroundColor: '#270808',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  devHint: {
    fontSize: 11,
    color: '#FCA5A5',
    marginTop: 6,
    marginBottom: 16,
  },
  devHintBold: {
    fontWeight: '800',
    color: '#FDE047',
  },
  unlockButton: {
    backgroundColor: '#DC2626',
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  }
});

// ============================================================================
// The Gem: Phone + SMS OTP Authentication Modal
// Secure Authentication for Merchants and Hired Sellers
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { UserRole } from '../types';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const { 
    role, 
    requestLoginOtp, 
    verifyLoginOtp, 
    currentUserPhone, 
    currentUserName,
    isAuthenticated,
    logout 
  } = useAppStore();

  const [phone, setPhone] = useState<string>(currentUserPhone);
  const [selectedRole, setSelectedRole] = useState<UserRole>(role);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [mockHint, setMockHint] = useState<string>('');

  const handleRequestOtp = () => {
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Please enter your mobile phone number.');
      return;
    }

    const userName = selectedRole === 'MERCHANT' ? 'Main Merchant' : 'Hired Seller';
    const res = requestLoginOtp(phone.trim(), selectedRole, userName);

    if (res.success) {
      setOtpSent(true);
      setMockHint(res.mockOtp || '123456');
      Alert.alert('SMS OTP Sent', res.message);
    } else {
      Alert.alert('Request Failed', res.message);
    }
  };

  const handleVerifyOtp = () => {
    if (!otpCode.trim()) {
      Alert.alert('OTP Required', 'Please enter the 6-digit code received via SMS.');
      return;
    }

    const res = verifyLoginOtp(otpCode.trim());
    if (res.success) {
      Alert.alert('Authenticated', `Welcome back! Logged in as ${res.role}.`);
      setOtpSent(false);
      setOtpCode('');
      onClose();
    } else {
      Alert.alert('Verification Failed', res.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="cellphone-key" size={24} color={THEME.colors.primary} />
              <View>
                <Text style={styles.title}>PHONE + SMS OTP SECURITY</Text>
                <Text style={styles.subtitle}>Cryptographic Access for Market Operations</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Role Switcher in Auth */}
            <Text style={styles.label}>LOGIN ROLE</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, selectedRole === 'MERCHANT' && styles.roleBtnActiveMerchant]}
                onPress={() => setSelectedRole('MERCHANT')}
              >
                <Text style={[styles.roleBtnText, selectedRole === 'MERCHANT' && styles.textWhite]}>
                  Merchant (Admin)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleBtn, selectedRole === 'SELLER' && styles.roleBtnActiveSeller]}
                onPress={() => setSelectedRole('SELLER')}
              >
                <Text style={[styles.roleBtnText, selectedRole === 'SELLER' && styles.textWhite]}>
                  Hired Seller
                </Text>
              </TouchableOpacity>
            </View>

            {/* Phone Input */}
            <Text style={styles.label}>MOBILE PHONE NUMBER</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.flagBadge}>
                <Text style={styles.flagText}>🇰🇪 +254</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="712 345 678"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {!otpSent ? (
              <TouchableOpacity style={styles.sendOtpBtn} onPress={handleRequestOtp}>
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                <Text style={styles.sendOtpBtnText}>SEND SMS OTP CODE</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.otpSection}>
                <View style={styles.mockHintBox}>
                  <Text style={styles.mockHintText}>
                    Mock Dev SMS Received: <Text style={styles.mockCode}>{mockHint}</Text>
                  </Text>
                </View>

                <Text style={styles.label}>ENTER 6-DIGIT OTP</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />

                <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyOtp}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.verifyBtnText}>VERIFY & SIGN IN</Text>
                </TouchableOpacity>
              </View>
            )}
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
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
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
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  roleBtnActiveMerchant: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  roleBtnActiveSeller: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  flagBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  flagText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sendOtpBtn: {
    backgroundColor: THEME.colors.primary,
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sendOtpBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  otpSection: {
    marginTop: 8,
  },
  mockHintBox: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 12,
  },
  mockHintText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  mockCode: {
    fontWeight: '900',
    fontSize: 13,
    color: '#78350F',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    color: THEME.colors.primary,
    marginBottom: 14,
  },
  verifyBtn: {
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  }
});

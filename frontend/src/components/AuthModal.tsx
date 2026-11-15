// ============================================================================
// The Gem: Seller Phone + SMS OTP Verification & Login Modal
// Secure Authentication for Hired Sellers at Wakulima Market (Marikiti)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { UserRole } from '../types';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

interface SellerProfilePreset {
  id: string;
  name: string;
  phone: string;
  roleDescription: string;
}

const REGISTERED_SELLER_PRESETS: SellerProfilePreset[] = [
  {
    id: 'seller-juma',
    name: 'Juma (Sales Assistant)',
    phone: '0799887766',
    roleDescription: 'Allocated Day 1 Seller Quota'
  },
  {
    id: 'seller-otieno',
    name: 'Otieno (Market Seller)',
    phone: '0712334455',
    roleDescription: 'Offload & Fast Retail'
  },
  {
    id: 'seller-custom',
    name: 'New / Other Seller',
    phone: '',
    roleDescription: 'Custom Kenyan Mobile Number'
  }
];

export const AuthModal: React.FC<AuthModalProps> = ({ 
  visible, 
  onClose,
  initialRole = 'SELLER'
}) => {
  const { 
    role, 
    requestSellerOtp, 
    verifySellerOtp, 
    currentBatch,
    isDarkMode 
  } = useAppStore();

  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('seller-juma');
  const [sellerName, setSellerName] = useState<string>('Juma (Sales Assistant)');
  const [phone, setPhone] = useState<string>('0799887766');
  
  // OTP Flow State
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [mockHint, setMockHint] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(1);

  // Sync initialRole when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedRole(initialRole);
      if (initialRole === 'SELLER') {
        setSelectedPresetId('seller-juma');
        setSellerName('Juma (Sales Assistant)');
        setPhone('0799887766');
      } else {
        setSelectedPresetId('merchant-admin');
        setSellerName('Master (Admin)');
        setPhone('0712345678');
      }
      setOtpSent(false);
      setOtpCode('');
      setCountdown(0);
      setAttempts(1);
    }
  }, [visible, initialRole]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSelectPreset = (preset: SellerProfilePreset) => {
    setSelectedPresetId(preset.id);
    if (preset.id !== 'seller-custom') {
      setSellerName(preset.name);
      setPhone(preset.phone);
    } else {
      setSellerName('');
      setPhone('');
    }
  };

  const handleRequestOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Please enter a valid Kenyan phone number.');
      return;
    }

    const res = await requestSellerOtp(phone.trim(), 'LOGIN');

    if (res.success) {
      setOtpSent(true);
      setCountdown(60);

      Alert.alert(
        '📲 SMS OTP Dispatched',
        `Verification code sent to ${phone.trim()}.\n\nEnter the 6-digit code below to sign in.`
      );
    } else {
      Alert.alert('Request Failed', res.message);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit verification code.');
      return;
    }

    const res = await verifySellerOtp(phone.trim(), otpCode.trim());

    if (res.success) {
      const truck = currentBatch?.truckPlate || 'Active Stock';
      Alert.alert(
        '✅ Verified & Logged In',
        `Karibu ${res.sellerName || sellerName}!\n\nActive on Truck: ${truck}`,
        [{ text: 'Continue to Terminal', onPress: onClose }]
      );
    } else {
      setAttempts(prev => prev + 1);
      Alert.alert('Authentication Failed', res.message);
    }
  };

  const handleAutoFillDevCode = () => {
    setOtpCode(mockHint || '123456');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Mobile Bottom-Sheet Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, isDarkMode && { backgroundColor: '#475569' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <View style={styles.titleRow}>
              <View style={[styles.iconBadge, selectedRole === 'SELLER' ? styles.iconBadgeSeller : styles.iconBadgeMerchant]}>
                <MaterialCommunityIcons 
                  name={selectedRole === 'SELLER' ? "badge-account" : "shield-account"} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </View>
              <View>
                <Text style={[styles.title, isDarkMode && { color: '#F8FAFC' }]}>
                  {selectedRole === 'SELLER' ? 'SELLER LOGIN • SMS OTP' : 'MASTER ACCESS LOGIN'}
                </Text>
                <Text style={[styles.subtitle, isDarkMode && { color: '#94A3B8' }]}>
                  {selectedRole === 'SELLER' 
                    ? 'Authenticate seller session to log sales & track quota' 
                    : 'Master cryptographic sign-in'
                  }
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#94A3B8' : THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Role Switcher in Auth */}
            <View style={[styles.roleRow, isDarkMode && { backgroundColor: '#0F172A' }]}>
              <TouchableOpacity
                style={[
                  styles.roleBtn,
                  selectedRole === 'SELLER' && styles.roleBtnActiveSeller
                ]}
                onPress={() => {
                  setSelectedRole('SELLER');
                  setSelectedPresetId('seller-juma');
                  setSellerName('Juma (Sales Assistant)');
                  setPhone('0799887766');
                  setOtpSent(false);
                }}
              >
                <Ionicons name="person" size={13} color={selectedRole === 'SELLER' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.roleBtnText, selectedRole === 'SELLER' && styles.textWhite]}>
                  Hired Seller Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleBtn,
                  selectedRole === 'MERCHANT' && styles.roleBtnActiveMerchant
                ]}
                onPress={() => {
                  setSelectedRole('MERCHANT');
                  setSelectedPresetId('merchant-admin');
                  setSellerName('Master (Admin)');
                  setPhone('0712345678');
                  setOtpSent(false);
                }}
              >
                <Ionicons name="shield-checkmark" size={13} color={selectedRole === 'MERCHANT' ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.roleBtnText, selectedRole === 'MERCHANT' && styles.textWhite]}>
                  Master (Admin)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick-Select Registered Profiles for Sellers */}
            {selectedRole === 'SELLER' && (
              <View style={styles.presetsSection}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#CBD5E1' }]}>
                  SELECT REGISTERED SELLER
                </Text>
                <View style={styles.presetsGrid}>
                  {REGISTERED_SELLER_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetCard,
                        isDarkMode && styles.presetCardDark,
                        selectedPresetId === preset.id && styles.presetCardActive,
                        selectedPresetId === preset.id && isDarkMode && styles.presetCardActiveDark
                      ]}
                      onPress={() => handleSelectPreset(preset)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.presetTopRow}>
                        <Text style={[
                          styles.presetName,
                          isDarkMode && { color: '#F8FAFC' },
                          selectedPresetId === preset.id && { color: '#D97706' }
                        ]}>
                          {preset.name}
                        </Text>
                        {selectedPresetId === preset.id && (
                          <Ionicons name="checkmark-circle" size={14} color="#D97706" />
                        )}
                      </View>
                      <Text style={[styles.presetDesc, isDarkMode && { color: '#94A3B8' }]}>
                        {preset.phone ? `Phone: ${preset.phone}` : preset.roleDescription}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Seller Name (if custom) */}
            {selectedPresetId === 'seller-custom' && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#CBD5E1' }]}>SELLER FULL NAME</Text>
                <TextInput
                  style={[styles.textInput, isDarkMode && styles.textInputDark]}
                  placeholder="e.g. Kamau Wanyama"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={sellerName}
                  onChangeText={setSellerName}
                />
              </View>
            )}

            {/* Phone Input with Kenyan Flag */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#CBD5E1' }]}>
                {selectedRole === 'SELLER' ? 'SELLER MOBILE PHONE' : 'MASTER PHONE NUMBER'}
              </Text>
              <View style={styles.phoneInputRow}>
                <View style={[styles.flagBadge, isDarkMode && styles.flagBadgeDark]}>
                  <Text style={[styles.flagText, isDarkMode && { color: '#F8FAFC' }]}>🇰🇪 +254</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, isDarkMode && styles.phoneInputDark]}
                  placeholder="799 887 766"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!otpSent}
                />
              </View>
            </View>

            {/* Action 1: Request SMS OTP */}
            {!otpSent ? (
              <TouchableOpacity 
                style={[
                  styles.sendOtpBtn,
                  selectedRole === 'SELLER' ? styles.sendOtpBtnSeller : styles.sendOtpBtnMerchant
                ]} 
                onPress={handleRequestOtp}
                activeOpacity={0.8}
              >
                <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                <Text style={styles.sendOtpBtnText}>
                  {selectedRole === 'SELLER' ? 'DISPATCH SELLER LOGIN OTP' : 'SEND MASTER ACCESS CODE'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* Action 2: Verify SMS OTP */
              <View style={styles.otpSection}>
                {/* Simulated SMS Notification Helper */}
                <View style={[styles.mockSmsCard, isDarkMode && styles.mockSmsCardDark]}>
                  <View style={styles.mockSmsHeader}>
                    <Ionicons name="chatbox-ellipses" size={14} color="#059669" />
                    <Text style={styles.mockSmsTitle}>Simulated SMS Received ({phone})</Text>
                  </View>
                  <Text style={[styles.mockSmsBody, isDarkMode && { color: '#A7F3D0' }]}>
                    "THE GEM: Your login OTP for {sellerName} is <Text style={styles.mockCodeBold}>{mockHint}</Text>. Valid for 5 mins."
                  </Text>
                  <TouchableOpacity style={styles.autoFillBtn} onPress={handleAutoFillDevCode}>
                    <Ionicons name="flash" size={12} color="#0369A1" />
                    <Text style={styles.autoFillBtnText}>Auto-Fill Code ({mockHint})</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.otpInputHeaderRow}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#CBD5E1' }]}>
                    ENTER 6-DIGIT VERIFICATION CODE
                  </Text>
                  <Text style={[styles.attemptTrackerText, isDarkMode && { color: '#94A3B8' }]}>
                    Attempt {attempts} of 5
                  </Text>
                </View>

                <TextInput
                  style={[styles.otpInput, isDarkMode && styles.otpInputDark]}
                  placeholder="------"
                  placeholderTextColor={isDarkMode ? '#475569' : '#CBD5E1'}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  autoFocus
                />

                <TouchableOpacity 
                  style={styles.verifyBtn} 
                  onPress={handleVerifyOtp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.verifyBtnText}>
                    {selectedRole === 'SELLER' ? 'VERIFY & ENTER SELLER MODE' : 'VERIFY & SIGN IN'}
                  </Text>
                </TouchableOpacity>

                {/* Resend / Change Number Row */}
                <View style={styles.resendRow}>
                  <TouchableOpacity 
                    onPress={handleRequestOtp} 
                    disabled={countdown > 0}
                    style={{ opacity: countdown > 0 ? 0.5 : 1 }}
                  >
                    <Text style={[styles.resendText, isDarkMode && { color: '#22D3EE' }]}>
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP SMS'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#94A3B8' }}>•</Text>
                  <TouchableOpacity onPress={() => setOtpSent(false)}>
                    <Text style={[styles.changePhoneText, isDarkMode && { color: '#94A3B8' }]}>
                      Change Phone Number
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* DPA & Anti-Tamper Security Notice */}
            <View style={[styles.securityNotice, isDarkMode && styles.securityNoticeDark]}>
              <Ionicons name="shield-checkmark" size={13} color="#059669" />
              <Text style={[styles.securityNoticeText, isDarkMode && { color: '#94A3B8' }]}>
                Wakulima Market Anti-Tamper Shield: 5 consecutive failed OTP entries will lock down device terminals for master audit.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 520,
    paddingBottom: 24,
  },
  modalCardDark: {
    backgroundColor: '#1E293B',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerDark: {
    borderBottomColor: '#334155',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeSeller: {
    backgroundColor: '#D97706',
  },
  iconBadgeMerchant: {
    backgroundColor: '#0891B2',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 10.5,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    marginBottom: 14,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  roleBtnActiveSeller: {
    backgroundColor: '#D97706',
  },
  roleBtnActiveMerchant: {
    backgroundColor: THEME.colors.primary,
  },
  roleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  presetsSection: {
    marginBottom: 12,
  },
  presetsGrid: {
    gap: 6,
    marginTop: 4,
  },
  presetCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  presetCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  presetCardActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  presetCardActiveDark: {
    borderColor: '#D97706',
    backgroundColor: '#451A03',
  },
  presetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  presetDesc: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  textInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flagBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  flagBadgeDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  flagText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  phoneInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  sendOtpBtn: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendOtpBtnSeller: {
    backgroundColor: '#D97706',
    shadowColor: '#D97706',
  },
  sendOtpBtnMerchant: {
    backgroundColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
  },
  sendOtpBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
    letterSpacing: 0.5,
  },
  otpSection: {
    marginTop: 4,
  },
  mockSmsCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  mockSmsCardDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  mockSmsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  mockSmsTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
  },
  mockSmsBody: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 15,
  },
  mockCodeBold: {
    fontWeight: '900',
    letterSpacing: 2,
  },
  autoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  autoFillBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  otpInputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  attemptTrackerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 10,
    color: '#D97706',
    marginBottom: 12,
  },
  otpInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#F59E0B',
    color: '#FCD34D',
  },
  verifyBtn: {
    backgroundColor: '#059669',
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  resendText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
  },
  changePhoneText: {
    fontSize: 11,
    color: '#64748B',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  securityNoticeDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  securityNoticeText: {
    fontSize: 9.5,
    color: '#64748B',
    flex: 1,
    lineHeight: 13,
  }
});

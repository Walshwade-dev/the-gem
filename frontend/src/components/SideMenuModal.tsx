// ============================================================================
// The Gem: Side Menu & Settings Drawer (Mobile-First & Glassmorphism)
// Theme Settings, Produce Photos, 1-Click Social Sharing & PIN-Guarded Panic
// ============================================================================

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  TextInput, 
  Alert, 
  Share, 
  Linking, 
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';
import { ProduceGrade } from '../types';

interface SideMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_SAMPLE_PHOTOS = [
  {
    label: 'Cured Red Onions (Premium)',
    url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
  },
  {
    label: 'Bulk Sacks at Bay',
    url: 'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=800&auto=format&fit=crop&q=80',
  },
  {
    label: 'Large Firm Bulbs (G1)',
    url: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=800&auto=format&fit=crop&q=80',
  }
];

export const SideMenuModal: React.FC<SideMenuModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { 
    currentBatch, 
    role, 
    isDarkMode, 
    toggleTheme, 
    addBatchPhoto, 
    currentUserPhone,
    currentUserName,
    masterName,
    logout,
    lockdown 
  } = useAppStore();

  const effectiveMaster = masterName || (role === 'MERCHANT' ? currentUserName : '') || 'Master';

  // Add Photo states
  const [showAddPhoto, setShowAddPhoto] = useState<boolean>(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [newQualityNote, setNewQualityNote] = useState<string>('');

  // 1-Click Share states
  const [shareGrade, setShareGrade] = useState<ProduceGrade>('GRADE_1');
  const [packagingType, setPackagingType] = useState<'DUSURA_20KG' | 'TZ_50KG'>('DUSURA_20KG');
  const [bagPrice, setBagPrice] = useState<string>('1300');
  const [contactPhone, setContactPhone] = useState<string>(currentUserPhone || '+254712345678');
  const [orderChannel, setOrderChannel] = useState<string>('Call or WhatsApp');

  // PIN-Guarded Emergency Panic Controls
  const PANIC_SECURITY_PIN = '9999'; // 4-digit security PIN
  const [panicUnlocked, setPanicUnlocked] = useState<boolean>(false);
  const [showPinInput, setShowPinInput] = useState<boolean>(false);
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const weightKg = packagingType === 'DUSURA_20KG' ? 20 : 50;
  const numericBagPrice = parseFloat(bagPrice) || 0;
  const pricePerKg = weightKg > 0 && numericBagPrice > 0 ? (numericBagPrice / weightKg).toFixed(1) : '0';

  const handleSavePhoto = () => {
    if (!newPhotoUrl.trim()) {
      Alert.alert('Photo Required', 'Please enter a valid image URL or tap one of the presets.');
      return;
    }
    addBatchPhoto(newPhotoUrl.trim(), newQualityNote.trim() || undefined);
    Alert.alert('✅ Photo Saved', 'Produce photo and quality log have been added to the stock.');
    setNewPhotoUrl('');
    setNewQualityNote('');
    setShowAddPhoto(false);
  };

  const generateShareMessage = () => {
    const gradeLabel = shareGrade === 'GRADE_1' ? 'Grade 1' : 'Grade 2';
    const packLabel = packagingType === 'DUSURA_20KG' ? '20kg Net (Dusura)' : '50kg Net (TZ / Neti Kubwa)';
    const truckInfo = currentBatch ? `Truck: ${currentBatch.truckPlate}` : 'Fresh Market Stock';
    const primaryPhoto = currentBatch && currentBatch.photoUrls.length > 0 
      ? currentBatch.photoUrls[0] 
      : PRESET_SAMPLE_PHOTOS[0].url;

    return `🧅 *FRESH RED ONIONS WHOLESALE - WAKULIMA MARKET (MARIKITI)* 🧅
━━━━━━━━━━━━━━━━━━━━━
📦 *Produce:* ${gradeLabel}
⚖️ *Packaging:* ${packLabel} (${weightKg} kg)
💰 *Price per Net/Bag:* Ksh ${numericBagPrice.toLocaleString()}
🏷️ *Calculated Price:* ~Ksh ${pricePerKg} / kg
🚚 *Stock Arrival:* ${truckInfo}
✨ *Quality:* ${currentBatch?.qualityNotes || 'Firm cured bulbs, dry papery skin, premium quality.'}

📸 *Produce Photo:* ${primaryPhoto}
━━━━━━━━━━━━━━━━━━━━━
📍 *Pickup Location:* Wakulima Market (Marikiti), Haile Selassie Ave, Nairobi
📞 *Order / Booking Channel:* ${orderChannel} ${contactPhone}
⚡ Fast wholesale collection & delivery coordination available!`;
  };

  const handleShareToPlatforms = async () => {
    const message = generateShareMessage();
    try {
      await Share.share({
        message,
        title: 'Fresh Onion Wholesale Offer - Wakulima Market'
      });
    } catch {
      Alert.alert('Share Error', 'Could not open system share dialog.');
    }
  };

  const handleShareWhatsAppDirect = async () => {
    const message = generateShareMessage();
    const encoded = encodeURIComponent(message);
    const whatsappUrl = `whatsapp://send?text=${encoded}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message });
      }
    } catch {
      await Share.share({ message });
    }
  };

  const handleVerifyPin = () => {
    if (pinEntry.trim() === PANIC_SECURITY_PIN) {
      setPanicUnlocked(true);
      setShowPinInput(false);
      setPinEntry('');
      setPinError('');
    } else {
      setPinError('Incorrect security PIN. Default security PIN is 9999.');
    }
  };

  const handleTriggerPanic = () => {
    Alert.alert(
      '🚨 CONFIRM EMERGENCY LOCKDOWN',
      'This will immediately freeze all market sessions, lock out hired sellers, and encrypt transactions until the Master Admin recovery key is entered.\n\nProceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'FREEZE SYSTEM', 
          style: 'destructive',
          onPress: () => {
            onClose();
            lockdown('Manual Emergency Panic triggered from Side Menu');
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Light-dismiss touchable backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropDismiss} />
        </TouchableWithoutFeedback>

        <View style={[
          styles.drawerContainer,
          isDarkMode && styles.drawerContainerDark,
          { paddingBottom: Math.max(insets.bottom, 16) }
        ]}>
          {/* Mobile-first top drag indicator handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Header */}
          <View style={[styles.drawerHeader, isDarkMode && styles.drawerHeaderDark, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.drawerHeaderBrand}>
              <View style={[styles.drawerLogoWrapper, isDarkMode && styles.drawerLogoWrapperDark]}>
                <Image 
                  source={require('../../assets/faceted onion.jpeg')} 
                  style={styles.drawerLogoImage} 
                  resizeMode="contain" 
                />
              </View>
              <View>
                <Text style={[styles.drawerTitle, isDarkMode && styles.textWhite]}>Control & Catalog</Text>
                <Text style={[styles.drawerSubtitle, isDarkMode && { color: '#71717A' }]}>The Gem</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.closeBtn, isDarkMode && styles.closeBtnDark]} onPress={onClose}>
              <Ionicons name="close" size={20} color={isDarkMode ? '#F8FAFC' : THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollBody} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Theme Settings (Dark / Light Mode) */}
            <View style={[styles.glassCard, isDarkMode && styles.glassCardDark]}>
              <View style={styles.sectionHeader}>
                <Ionicons 
                  name={isDarkMode ? "moon" : "sunny"} 
                  size={18} 
                  color={isDarkMode ? "#A855F7" : "#F59E0B"} 
                />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textWhite]}>APPEARANCE (THEME)</Text>
              </View>

              <View style={styles.themeToggleRow}>
                <View style={styles.themeInfoCol}>
                  <Text style={[styles.themeLabel, isDarkMode && styles.textWhite]}>
                    {isDarkMode ? 'Dark High-Contrast Mode' : 'Light Daylight Mode'}
                  </Text>
                  <Text style={styles.themeHint}>
                    {isDarkMode ? 'Reduced glare for evening and warehouse use' : 'Optimized for bright outdoor market conditions'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[styles.togglePill, isDarkMode && styles.togglePillDark]} 
                  onPress={toggleTheme}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={isDarkMode ? "moon" : "sunny"} 
                    size={16} 
                    color={isDarkMode ? "#FFFFFF" : "#D97706"} 
                  />
                  <Text style={[styles.togglePillText, isDarkMode && styles.textWhite]}>
                    {isDarkMode ? 'Dark' : 'Light'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Produce Photos & Quality Log */}
            <View style={[styles.glassCard, isDarkMode && styles.glassCardDark]}>
              <View style={styles.sectionHeaderBetween}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="camera-iris" size={19} color="#0891B2" />
                  <Text style={[styles.sectionTitle, isDarkMode && styles.textWhite]}>PRODUCE PHOTOS & QUALITY LOG</Text>
                </View>
                <TouchableOpacity 
                  style={styles.addPhotoSmallBtn}
                  onPress={() => setShowAddPhoto(!showAddPhoto)}
                >
                  <Ionicons name={showAddPhoto ? "chevron-up" : "add-circle"} size={14} color="#0891B2" />
                  <Text style={styles.addPhotoSmallBtnText}>{showAddPhoto ? 'Cancel' : '+ Add Photo'}</Text>
                </TouchableOpacity>
              </View>

              {currentBatch ? (
                <>
                  <Text style={styles.stockNoticeText}>
                    Stock: <Text style={[styles.boldText, isDarkMode && styles.textWhite]}>{currentBatch.truckPlate}</Text> • Day {currentBatch.dayNumber} of stay
                  </Text>

                  {/* Add Photo Expandable Form */}
                  {showAddPhoto && (
                    <View style={[styles.addPhotoForm, isDarkMode && styles.addPhotoFormDark]}>
                      <Text style={styles.inputLabel}>CHOOSE FROM PRESETS OR PASTE URL</Text>
                      <View style={styles.presetsRow}>
                        {PRESET_SAMPLE_PHOTOS.map((p, idx) => (
                          <TouchableOpacity 
                            key={idx}
                            style={[
                              styles.presetPhotoChip,
                              newPhotoUrl === p.url && styles.presetPhotoChipActive
                            ]}
                            onPress={() => setNewPhotoUrl(p.url)}
                          >
                            <Text style={[
                              styles.presetPhotoChipText,
                              newPhotoUrl === p.url && styles.presetPhotoChipTextActive
                            ]}>
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        style={[styles.urlInput, isDarkMode && styles.inputDark]}
                        placeholder="Or enter image URL (https://...)"
                        placeholderTextColor={THEME.colors.textMuted}
                        value={newPhotoUrl}
                        onChangeText={setNewPhotoUrl}
                      />

                      <Text style={styles.inputLabel}>QUALITY NOTE / PRODUCE CONDITION</Text>
                      <TextInput
                        style={[styles.notesInput, isDarkMode && styles.inputDark]}
                        placeholder="e.g. Well-cured Singida bulbs, dry outer layers, firm neck"
                        placeholderTextColor={THEME.colors.textMuted}
                        value={newQualityNote}
                        onChangeText={setNewQualityNote}
                        multiline
                      />

                      <TouchableOpacity style={styles.savePhotoBtn} onPress={handleSavePhoto}>
                        <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.savePhotoBtnText}>Save Photo to Batch</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Current Photos Gallery */}
                  {currentBatch.photoUrls.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoListScroll}>
                      {currentBatch.photoUrls.map((url, idx) => (
                        <View key={idx} style={styles.photoCard}>
                          <Image source={{ uri: url }} style={styles.photoImg} />
                          <View style={styles.photoBadge}>
                            <Text style={styles.photoBadgeText}>Photo #{idx + 1}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.noPhotosText}>No photos attached to this truck stock yet.</Text>
                  )}

                  {/* Quality description */}
                  <View style={[styles.qualityBox, isDarkMode && styles.qualityBoxDark]}>
                    <Text style={styles.qualityBoxTitle}>Current Batch Quality Assessment:</Text>
                    <Text style={[styles.qualityBoxDesc, isDarkMode && styles.textWhiteLight]}>
                      {currentBatch.qualityNotes || 'Firm cured bulbs with high dry-matter content. Low shrinkage risk.'}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noPhotosText}>No active truck batch. Photos are tied to active truck stock.</Text>
              )}
            </View>

            {/* 3. 1-Click Multi-Platform Social Share */}
            <View style={[styles.glassCard, isDarkMode && styles.glassCardDark]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="share-social" size={18} color="#059669" />
                <Text style={[styles.sectionTitle, isDarkMode && styles.textWhite]}>1-CLICK SOCIAL MEDIA & WHATSAPP ADVERT</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Broadcast stock to WhatsApp status, broadcast lists, and buyers with one tap.
              </Text>

              {/* Grade Selector */}
              <Text style={styles.inputLabel}>1. SELECT PRODUCE GRADE</Text>
              <View style={styles.buttonToggleRow}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, shareGrade === 'GRADE_1' && styles.toggleBtnActiveG1]}
                  onPress={() => {
                    setShareGrade('GRADE_1');
                    setBagPrice(packagingType === 'DUSURA_20KG' ? '1300' : '3250');
                  }}
                >
                  <Text style={[styles.toggleBtnText, shareGrade === 'GRADE_1' && styles.textWhite]}>
                    Grade 1
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.toggleBtn, shareGrade === 'GRADE_2' && styles.toggleBtnActiveG2]}
                  onPress={() => {
                    setShareGrade('GRADE_2');
                    setBagPrice(packagingType === 'DUSURA_20KG' ? '1200' : '3000');
                  }}
                >
                  <Text style={[styles.toggleBtnText, shareGrade === 'GRADE_2' && styles.textWhite]}>
                    Grade 2
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Packaging Selector */}
              <Text style={styles.inputLabel}>2. PACKAGING & WEIGHT SPECIFICATION</Text>
              <View style={styles.buttonToggleRow}>
                <TouchableOpacity 
                  style={[styles.toggleBtn, packagingType === 'DUSURA_20KG' && styles.toggleBtnActiveGeneric]}
                  onPress={() => setPackagingType('DUSURA_20KG')}
                >
                  <Text style={[styles.toggleBtnText, packagingType === 'DUSURA_20KG' && styles.textWhite]}>
                    20kg Net (Dusura)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.toggleBtn, packagingType === 'TZ_50KG' && styles.toggleBtnActiveGeneric]}
                  onPress={() => setPackagingType('TZ_50KG')}
                >
                  <Text style={[styles.toggleBtnText, packagingType === 'TZ_50KG' && styles.textWhite]}>
                    50kg Net (TZ / Neti Kubwa)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Price per Bag */}
              <View style={styles.priceRow}>
                <View style={styles.priceCol}>
                  <Text style={styles.inputLabel}>PRICE PER BAG / NET (KSH)</Text>
                  <TextInput 
                    style={[styles.priceInput, isDarkMode && styles.inputDark]}
                    value={bagPrice}
                    onChangeText={setBagPrice}
                    keyboardType="numeric"
                    placeholder="1300"
                  />
                </View>

                <View style={styles.calcCol}>
                  <Text style={styles.calcLabel}>RATE PER KG</Text>
                  <View style={[styles.calcBox, isDarkMode && styles.calcBoxDark]}>
                    <Text style={styles.calcValue}>Ksh {pricePerKg}</Text>
                    <Text style={styles.calcUnit}>/ kg</Text>
                  </View>
                </View>
              </View>

              {/* Channel / Contact */}
              <Text style={styles.inputLabel}>BUYER REQUEST CHANNEL & CONTACT</Text>
              <TextInput 
                style={[styles.textInputFull, isDarkMode && styles.inputDark]}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+254 712 345 678"
                keyboardType="phone-pad"
              />

              <TextInput 
                style={[styles.textInputFull, isDarkMode && styles.inputDark, { marginTop: 6 }]}
                value={orderChannel}
                onChangeText={setOrderChannel}
                placeholder="Call or WhatsApp"
              />

              {/* Live Preview Box */}
              <View style={[styles.previewBox, isDarkMode && styles.previewBoxDark]}>
                <Text style={styles.previewLabel}>ADVERT MESSAGE PREVIEW:</Text>
                <Text style={[styles.previewText, isDarkMode && styles.textWhiteLight]} numberOfLines={6}>
                  {generateShareMessage()}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.shareActionRow}>
                <TouchableOpacity 
                  style={styles.whatsappBtn}
                  onPress={handleShareWhatsAppDirect}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.whatsappBtnText}>WhatsApp 1-Click</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.platformShareBtn}
                  onPress={handleShareToPlatforms}
                  activeOpacity={0.85}
                >
                  <Ionicons name="share-outline" size={18} color="#0891B2" />
                  <Text style={styles.platformShareBtnText}>All Platforms</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. PIN-Guarded Emergency Panic Lockdown (Merchant Only) */}
            {role === 'MERCHANT' && (
              <View style={[styles.glassCard, styles.panicGlassCard, isDarkMode && styles.panicGlassCardDark]}>
                <View style={styles.sectionHeaderBetween}>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="shield-alert" size={18} color="#DC2626" />
                    <Text style={[styles.sectionTitle, { color: '#DC2626' }]}>
                      EMERGENCY PANIC LOCKDOWN
                    </Text>
                  </View>
                  <View style={[styles.lockStatusBadge, panicUnlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                    <Ionicons 
                      name={panicUnlocked ? "lock-open" : "lock-closed"} 
                      size={11} 
                      color={panicUnlocked ? "#059669" : "#B91C1C"} 
                    />
                    <Text style={[styles.lockStatusText, panicUnlocked ? { color: '#059669' } : { color: '#B91C1C' }]}>
                      {panicUnlocked ? 'ARMED' : 'PIN-LOCKED'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionDesc}>
                  Safety kill-switch to freeze all sessions and protect drawer balances during theft or disputes. Protected by PIN to prevent accidental triggers.
                </Text>

                {!panicUnlocked ? (
                  <View>
                    {!showPinInput ? (
                      <TouchableOpacity 
                        style={styles.unlockPinTriggerBtn}
                        onPress={() => setShowPinInput(true)}
                      >
                        <Ionicons name="key" size={15} color="#DC2626" />
                        <Text style={styles.unlockPinTriggerText}>Enter PIN to Arm Panic Control</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.pinEntryBox}>
                        <Text style={styles.inputLabel}>ENTER 4-DIGIT SECURITY PIN (DEFAULT: 9999)</Text>
                        <View style={styles.pinInputRow}>
                          <TextInput 
                            style={styles.pinTextInput}
                            value={pinEntry}
                            onChangeText={(val) => {
                              setPinEntry(val);
                              if (pinError) setPinError('');
                            }}
                            placeholder="••••"
                            placeholderTextColor="#94A3B8"
                            secureTextEntry
                            keyboardType="numeric"
                            maxLength={4}
                          />
                          <TouchableOpacity style={styles.verifyPinBtn} onPress={handleVerifyPin}>
                            <Text style={styles.verifyPinBtnText}>Unlock</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.cancelPinBtn} 
                            onPress={() => {
                              setShowPinInput(false);
                              setPinEntry('');
                              setPinError('');
                            }}
                          >
                            <Ionicons name="close" size={16} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                        {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.unlockedPanicActions}>
                    <TouchableOpacity 
                      style={styles.armedPanicBtn}
                      onPress={handleTriggerPanic}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="warning" size={18} color="#FFFFFF" />
                      <Text style={styles.armedPanicBtnText}>TRIGGER EMERGENCY FREEZE NOW</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.relockBtn}
                      onPress={() => {
                        setPanicUnlocked(false);
                        setShowPinInput(false);
                      }}
                    >
                      <Ionicons name="lock-closed" size={13} color="#64748B" />
                      <Text style={styles.relockBtnText}>Re-lock Controls</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* 5. Terminal Session & Logout */}
            <View style={[styles.glassCard, styles.sessionCard, isDarkMode && styles.sessionCardDark]}>
              <View style={styles.sectionHeader}>
                <Ionicons 
                  name={role === 'MERCHANT' ? "shield-checkmark" : "person-circle"} 
                  size={18} 
                  color={role === 'MERCHANT' ? "#059669" : "#F59E0B"} 
                />
                <Text style={[styles.sectionTitle, isDarkMode && { color: '#F8FAFC' }]}>
                  ACTIVE TERMINAL SESSION
                </Text>
              </View>

              <View style={styles.sessionInfoRow}>
                <View style={styles.sessionTextCol}>
                  <Text style={[styles.sessionName, isDarkMode && { color: '#F8FAFC' }]}>
                    {role === 'MERCHANT' ? effectiveMaster : (currentUserName || 'Seller')}
                  </Text>
                  <Text style={[styles.sessionRoleLabel, isDarkMode && { color: '#94A3B8' }]}>
                    {role === 'MERCHANT' ? `🛡️ ${effectiveMaster} (Administrator)` : '👤 Authorized Sales Associate'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.drawerLogoutBtn}
                onPress={() => {
                  onClose();
                  logout();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                <Text style={styles.drawerLogoutBtnText}>Log Out & Lock Terminal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: 540, // Mobile-first ergonomic container for phones & tablets
    alignSelf: 'center',
    backgroundColor: THEME.colors.background,
  },
  drawerContainerDark: {
    backgroundColor: '#1D575D',
  },
  dragHandleContainer: {
    display: 'none',
  },
  dragIndicator: {
    display: 'none',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as any) : {}),
  },
  drawerHeaderDark: {
    backgroundColor: '#256A71',
    borderBottomColor: '#7AB5BC',
  },
  drawerHeaderBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerLogoWrapper: {
    width: 38,
    height: 42,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerLogoWrapperDark: {
    backgroundColor: 'transparent',
  },
  drawerLogoImage: {
    width: '100%',
    height: '100%',
  },
  closeBtnDark: {
    backgroundColor: '#1B4F55',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(8, 145, 178, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  drawerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as any) : {}),
  },
  glassCardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  panicGlassCard: {
    backgroundColor: 'rgba(254, 242, 242, 0.85)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  panicGlassCardDark: {
    backgroundColor: '#2A1215',
    borderColor: '#991B1B',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  themeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  themeInfoCol: {
    flex: 1,
    paddingRight: 12,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  themeHint: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  togglePillDark: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  togglePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  stockNoticeText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addPhotoSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: '#A5F3FC',
  },
  addPhotoSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  addPhotoForm: {
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addPhotoFormDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: '#334155',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetPhotoChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetPhotoChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  presetPhotoChipText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  presetPhotoChipTextActive: {
    color: '#FFFFFF',
  },
  urlInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  inputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#475569',
    color: '#F8FAFC',
  },
  savePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 8,
    borderRadius: 6,
  },
  savePhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoListScroll: {
    marginBottom: 10,
  },
  photoCard: {
    position: 'relative',
    marginRight: 10,
    borderRadius: THEME.borderRadius.md,
    overflow: 'hidden',
  },
  photoImg: {
    width: 120,
    height: 85,
    borderRadius: THEME.borderRadius.md,
  },
  photoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  qualityBox: {
    backgroundColor: 'rgba(240, 253, 250, 0.85)',
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
    padding: 10,
    borderRadius: 4,
  },
  qualityBoxDark: {
    backgroundColor: 'rgba(22, 78, 99, 0.3)',
    borderLeftColor: '#38BDF8',
  },
  qualityBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
    marginBottom: 2,
  },
  qualityBoxDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  noPhotosText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    marginVertical: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  buttonToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleBtnActiveG1: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  toggleBtnActiveG2: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  toggleBtnActiveGeneric: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textWhiteLight: {
    color: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  priceCol: {
    flex: 1.2,
  },
  calcCol: {
    flex: 0.8,
  },
  priceInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  calcLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  calcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  calcBoxDark: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderColor: '#059669',
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  calcUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginLeft: 3,
  },
  textInputFull: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  previewBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewBoxDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: '#334155',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  shareActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  whatsappBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  platformShareBtn: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(8, 145, 178, 0.1)',
    borderWidth: 1.5,
    borderColor: '#0891B2',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
  },
  platformShareBtnText: {
    color: '#0891B2',
    fontWeight: '700',
    fontSize: 13,
  },

  // PIN-Guarded Emergency Controls
  lockStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeLocked: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  badgeUnlocked: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  lockStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unlockPinTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
  },
  unlockPinTriggerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  pinEntryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pinInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pinTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    color: '#0F172A',
  },
  verifyPinBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyPinBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelPinBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 6,
  },
  unlockedPanicActions: {
    gap: 8,
  },
  armedPanicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  armedPanicBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  relockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  relockBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sessionCard: {
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  sessionCardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderColor: 'rgba(51, 65, 85, 0.6)',
  },
  sessionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
    padding: 10,
    borderRadius: 8,
  },
  sessionTextCol: {
    flex: 1,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sessionRoleLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  drawerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
  },
  drawerLogoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
});

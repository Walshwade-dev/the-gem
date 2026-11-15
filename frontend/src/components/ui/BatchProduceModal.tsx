// ============================================================================
// The Gem: Batch Produce, Photos & Packaging Modal
// Displays the view list of all produce items, images, descriptions, pricing,
// and packaging relating to this batch.
// Allows setting custom package size in KGs, custom origin, uploading multiple
// views (2 photos) per product from device, and deleting uploaded products.
// ============================================================================

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { BatchProduct, ProduceGrade } from '../../types';

interface BatchProduceModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProductForSale?: (product: BatchProduct) => void;
  isDarkMode?: boolean;
}

export const BatchProduceModal: React.FC<BatchProduceModalProps> = ({
  visible,
  onClose,
  onSelectProductForSale,
  isDarkMode = false,
}) => {
  const { 
    currentBatch, 
    role, 
    batchProducts, 
    addBatchProduct, 
    deleteBatchProduct,
    createProductAndBatch,
    updateBatchPricing 
  } = useAppStore();

  // Upload Form Visibility & Price Adjustment Visibility
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPriceAdjustForm, setShowPriceAdjustForm] = useState(false);

  // Price adjustment form states (for adjusting selling prices as days move)
  const [adjPriceG1, setAdjPriceG1] = useState(
    (currentBatch?.pricePerBagGrade1 ?? 1300).toString()
  );
  const [adjMinPriceG1, setAdjMinPriceG1] = useState(
    (currentBatch?.minPriceGrade1 ?? 1200).toString()
  );
  const [adjPriceG2, setAdjPriceG2] = useState(
    (currentBatch?.pricePerBagGrade2 ?? 800).toString()
  );
  const [adjMinPriceG2, setAdjMinPriceG2] = useState(
    (currentBatch?.minPriceGrade2 ?? 700).toString()
  );

  // Per-card active photo view index (supports multiple views of same product)
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({});

  // Format Default Origin: 2 names maximum (e.g. "Singida, Tanzania")
  const getDefaultOrigin = (): string => {
    if (!currentBatch) return 'Singida, Tanzania';
    const reg = currentBatch.origin.regionName || '';
    const spec = currentBatch.origin.specificLocation || '';
    if (/singida/i.test(reg) || /singida/i.test(spec)) return 'Singida, Tanzania';
    if (/tanzania/i.test(reg)) return 'Northern Tanzania';
    if (/kajiado/i.test(reg) || /oloitokitok/i.test(reg) || /rom/i.test(spec)) return 'Loitokitok, Kenya';
    if (/naivasha/i.test(reg)) return 'Naivasha, Kenya';
    const clean = reg.split('(')[0].trim();
    const words = clean.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ') || 'Singida, Tanzania';
  };

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadOrigin, setUploadOrigin] = useState(getDefaultOrigin());
  const [uploadTruckPlate, setUploadTruckPlate] = useState(currentBatch?.truckPlate || 'KDE 421B');
  const [uploadGrade, setUploadGrade] = useState<ProduceGrade>('GRADE_1');
  const [packagingPreset, setPackagingPreset] = useState<'100KG' | '50KG' | '25KG' | '10KG' | 'CUSTOM'>('100KG');
  const [uploadPackagingName, setUploadPackagingName] = useState('100KG NET');
  const [uploadWeightKg, setUploadWeightKg] = useState('100');
  const [uploadPricePerBag, setUploadPricePerBag] = useState('1300');
  const [uploadMinPrice, setUploadMinPrice] = useState('1200');
  const [uploadAvailableBags, setUploadAvailableBags] = useState('350');
  const [uploadDescription, setUploadDescription] = useState('');

  // Grade 2 Configuration
  const [hasGrade2Stock, setHasGrade2Stock] = useState(true);
  const [uploadPriceGrade2, setUploadPriceGrade2] = useState('800');
  const [uploadMinPriceGrade2, setUploadMinPriceGrade2] = useState('700');
  const [uploadStockGrade2, setUploadStockGrade2] = useState('20');
  
  // Multiple Views (View 1 & View 2)
  const [uploadPhotoUri1, setUploadPhotoUri1] = useState<string | null>(null);
  const [uploadPhotoUri2, setUploadPhotoUri2] = useState<string | null>(null);
  const [uploadTags, setUploadTags] = useState<string[]>(['New Stock', 'Grade 1', 'Cured Dry']);

  // Sync origin and prices default when batch changes
  useEffect(() => {
    setUploadOrigin(getDefaultOrigin());
    if (currentBatch) {
      setUploadTruckPlate(currentBatch.truckPlate);
      if (currentBatch.pricePerBagGrade1) setAdjPriceG1(currentBatch.pricePerBagGrade1.toString());
      if (currentBatch.minPriceGrade1) setAdjMinPriceG1(currentBatch.minPriceGrade1.toString());
      if (currentBatch.pricePerBagGrade2) setAdjPriceG2(currentBatch.pricePerBagGrade2.toString());
      if (currentBatch.minPriceGrade2) setAdjMinPriceG2(currentBatch.minPriceGrade2.toString());
    }
  }, [currentBatch]);

  // Image Picker for Specific View Slot (View 1 or View 2)
  const handlePickPhotoSlot = async (slot: 1 | 2, mode: 'gallery' | 'camera') => {
    try {
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Camera access is required to take product photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          if (slot === 1) setUploadPhotoUri1(result.assets[0].uri);
          else setUploadPhotoUri2(result.assets[0].uri);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Gallery access is needed to select product photos from your device.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          if (slot === 1) setUploadPhotoUri1(result.assets[0].uri);
          else setUploadPhotoUri2(result.assets[0].uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open device photo picker.');
    }
  };

  // Pick Multiple Photos at Once (Up to 2 Views)
  const handlePickMultiplePhotos = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Gallery access is needed to select product photos from your device.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 2,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (result.assets[0]) setUploadPhotoUri1(result.assets[0].uri);
        if (result.assets[1]) setUploadPhotoUri2(result.assets[1].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  // Packaging Preset Selection
  const handleSelectPackagingPreset = (preset: '100KG' | '50KG' | '25KG' | '10KG' | 'CUSTOM') => {
    setPackagingPreset(preset);
    if (preset === '100KG') {
      setUploadWeightKg('100');
      setUploadPackagingName('100KG NET');
      setUploadPricePerBag('13000');
    } else if (preset === '50KG') {
      setUploadWeightKg('50');
      setUploadPackagingName('50KG BAG');
      setUploadPricePerBag('6500');
    } else if (preset === '25KG') {
      setUploadWeightKg('25');
      setUploadPackagingName('25KG NET');
      setUploadPricePerBag('3400');
    } else if (preset === '10KG') {
      setUploadWeightKg('10');
      setUploadPackagingName('10KG POCKET');
      setUploadPricePerBag('1400');
    } else {
      // Custom
      setUploadPackagingName(`${uploadWeightKg || '75'}KG CUSTOM NET`);
    }
  };

  // Handle Custom Weight input
  const handleCustomWeightChange = (val: string) => {
    setUploadWeightKg(val);
    if (packagingPreset === 'CUSTOM') {
      setUploadPackagingName(`${val.trim() || 'Custom'}KG NET`);
    }
  };

  const toggleTag = (tag: string) => {
    setUploadTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Submit New Product to Batch
  const handleSaveProduct = () => {
    if (!uploadTitle.trim()) {
      Alert.alert('Missing Field', 'Please provide a product title (e.g. Singida Red Jumbo Net).');
      return;
    }
    const price = parseFloat(uploadPricePerBag);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price per bag / net (number/float).');
      return;
    }
    const weight = parseFloat(uploadWeightKg);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid package weight in KGs (number/float, e.g. 50, 80, 100).');
      return;
    }
    const available = Math.max(1, Math.floor(parseInt(uploadAvailableBags, 10)) || 1);

    const defaultFallbacks = [
      'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508747703725-719777637510?w=600&auto=format&fit=crop&q=80',
    ];

    const photos: string[] = [];
    if (uploadPhotoUri1) photos.push(uploadPhotoUri1);
    if (uploadPhotoUri2) photos.push(uploadPhotoUri2);
    if (photos.length === 0) {
      photos.push(defaultFallbacks[0]);
      photos.push(defaultFallbacks[1]);
    } else if (photos.length === 1) {
      photos.push(defaultFallbacks[1]);
    }

    const finalOrigin = uploadOrigin.trim() || getDefaultOrigin();
    const finalPackaging = uploadPackagingName.trim() || `${weight}KG NET`;
    const finalTruck = uploadTruckPlate.trim().toUpperCase() || currentBatch?.truckPlate || 'KDE 421B';
    const minPriceG1 = Math.max(0, parseFloat(uploadMinPrice) || Math.round(price * 0.9));
    const priceG2 = hasGrade2Stock ? Math.max(0, parseFloat(uploadPriceGrade2) || 0) : 0;
    const minPriceG2 = hasGrade2Stock ? Math.max(0, parseFloat(uploadMinPriceGrade2) || Math.round(priceG2 * 0.9)) : 0;
    const stockG2 = hasGrade2Stock ? Math.max(0, Math.floor(parseInt(uploadStockGrade2, 10)) || 0) : 0;

    createProductAndBatch({
      title: uploadTitle.trim(),
      origin: finalOrigin,
      truckPlate: finalTruck,
      packagingKg: weight,
      priceGrade1: price,
      minPriceGrade1: minPriceG1,
      stockGrade1: available,
      hasGrade2: hasGrade2Stock,
      priceGrade2: priceG2,
      minPriceGrade2: minPriceG2,
      stockGrade2: stockG2,
      photoUrls: photos,
      description: uploadDescription.trim() || `Cured onions in ${finalPackaging} (${weight} kg).`,
      tags: uploadTags.length > 0 ? uploadTags : ['New Stock', 'Grade 1', 'Cured Dry'],
    });

    // Reset Form
    setUploadTitle('');
    setUploadPhotoUri1(null);
    setUploadPhotoUri2(null);
    setUploadDescription('');
    setShowUploadForm(false);
    Alert.alert(
      '✅ Product & Batch Created',
      `"${uploadTitle.trim()}" (${weight} kg, ${finalOrigin}) on truck ${finalTruck} is now live and synchronized.\n\nGrade 1: Ksh ${price.toLocaleString()} (Min Floor: Ksh ${minPriceG1.toLocaleString()})\n${hasGrade2Stock ? `Grade 2: Ksh ${priceG2.toLocaleString()} (Min Floor: Ksh ${minPriceG2.toLocaleString()})\n` : ''}Active for all seller terminals.`
    );
  };

  // Adjust Selling Prices as Days Move
  const handleSaveAdjustedPrices = () => {
    const p1 = parseFloat(adjPriceG1);
    const m1 = parseFloat(adjMinPriceG1);
    const p2 = parseFloat(adjPriceG2);
    const m2 = parseFloat(adjMinPriceG2);

    if (isNaN(p1) || p1 <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid Grade 1 price.');
      return;
    }

    updateBatchPricing({
      pricePerBagGrade1: p1,
      minPriceGrade1: isNaN(m1) ? undefined : m1,
      pricePerBagGrade2: isNaN(p2) ? undefined : p2,
      minPriceGrade2: isNaN(m2) ? undefined : m2,
    });

    setShowPriceAdjustForm(false);
    Alert.alert(
      '✅ Batch Selling Prices Adjusted',
      `Grade 1: Ksh ${p1.toLocaleString()} (Min Floor: Ksh ${m1 || 0})\nGrade 2: Ksh ${p2.toLocaleString()} (Min Floor: Ksh ${m2 || 0})\n\nUpdated for Day ${currentBatch?.dayNumber || 1} and synchronized across all seller terminals.`
    );
  };

  // Delete Product Confirmation
  const handleDeleteProduct = (productId: string, productTitle: string) => {
    Alert.alert(
      'Delete Product?',
      `Are you sure you want to remove "${productTitle}" from this batch?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBatchProduct(productId);
            Alert.alert('🗑️ Product Deleted', `"${productTitle}" removed from batch.`);
          },
        },
      ]
    );
  };

  // Share Advert
  const handleShareAdvert = async (prod: BatchProduct) => {
    const pricePerKg = Math.round(prod.pricePerBag / (prod.weightKg || 1));
    const msg = `🧅 *WAKULIMA ONIONS - THE GEM* 🧅\n` +
      `📦 Produce: ${prod.title} (${prod.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'})\n` +
      `⚖️ Packaging: ${prod.packaging} (${prod.weightKg} kg)\n` +
      `💰 Price: Ksh ${prod.pricePerBag.toLocaleString()} (~Ksh ${pricePerKg}/kg)\n` +
      `🚚 Origin: ${prod.origin}\n` +
      `🚛 Truck: ${currentBatch?.truckPlate || 'KDE 421B'}\n` +
      `📍 Location: Wakulima Market (Marikiti), Nairobi\n` +
      `⚡ Available: ${prod.availableBags} units ready for immediate wholesale collection!`;

    try {
      await Share.share({ message: msg, title: 'Wakulima Onion Wholesale' });
    } catch {
      Alert.alert('Share Error', 'Could not open share dialogue.');
    }
  };

  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'New Stock':
        return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' };
      case 'Discounted':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
      case 'Large Size':
        return { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' };
      case 'Medium Size':
        return { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' };
      case 'Small Size':
        return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
      default:
        return { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' };
    }
  };

  const availableTagsList = ['New Stock', 'Discounted', 'Large Size', 'Medium Size', 'Small Size', 'Cured Dry'];

  // Calculate live preview unit price
  const previewWeight = parseFloat(uploadWeightKg) || 100;
  const previewPrice = parseFloat(uploadPricePerBag) || 0;
  const previewPricePerKg = Math.round(previewPrice / (previewWeight || 1));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="cube" size={18} color="#0891B2" />
              </View>
              <View>
                <Text style={[styles.modalTitle, isDarkMode && styles.textWhite]}>
                  Batch Produce & Packaging
                </Text>
                <Text style={styles.modalSubtitle}>
                  {currentBatch?.batchNumber || 'WB-20261022-01'} • {currentBatch?.truckPlate || 'KDE 421B'} • {getDefaultOrigin()}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Master Action Trigger Bar (Upload Product & Adjust Selling Prices) */}
          {role === 'MERCHANT' && (
            <View style={styles.uploadTriggerBar}>
              <TouchableOpacity
                style={[styles.uploadToggleBtn, showUploadForm && styles.uploadToggleBtnActive]}
                onPress={() => {
                  setShowUploadForm(!showUploadForm);
                  if (!showUploadForm) setShowPriceAdjustForm(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showUploadForm ? 'close-circle' : 'add-circle'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.uploadToggleBtnText}>
                  {showUploadForm ? 'Close Form' : '+ Add Product & Batch'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adjustPricesToggleBtn, showPriceAdjustForm && styles.adjustPricesToggleBtnActive]}
                onPress={() => {
                  setShowPriceAdjustForm(!showPriceAdjustForm);
                  if (!showPriceAdjustForm) setShowUploadForm(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showPriceAdjustForm ? 'close-circle' : 'options'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.adjustPricesToggleBtnText}>
                  {showPriceAdjustForm ? 'Close Adjustment' : '⚖️ Adjust Prices'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Price Adjustment Box (Master Only - Selling Price Shifts as Days Move) */}
            {role === 'MERCHANT' && showPriceAdjustForm && (
              <View style={[styles.priceAdjustFormBox, isDarkMode && styles.uploadFormBoxDark]}>
                <View style={styles.formSectionHeader}>
                  <Ionicons name="trending-down" size={16} color="#D97706" />
                  <Text style={[styles.formSectionTitle, isDarkMode && styles.textWhite]}>
                    Adjust Batch Selling Prices (Day {currentBatch?.dayNumber || 1} in Market)
                  </Text>
                </View>
                <Text style={styles.helperText}>
                  As days move, adjust wholesale prices and minimum floor limits. Updates sync immediately to all sales terminals.
                </Text>

                {/* Grade 1 Pricing Adjust */}
                <Text style={[styles.subSectionHeader, isDarkMode && styles.textWhite]}>GRADE 1 PRICING</Text>
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Selling Price (Ksh):</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      keyboardType="decimal-pad"
                      value={adjPriceG1}
                      onChangeText={setAdjPriceG1}
                      placeholder="e.g. 1300"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Min Floor Price (Ksh):</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      keyboardType="decimal-pad"
                      value={adjMinPriceG1}
                      onChangeText={setAdjMinPriceG1}
                      placeholder="e.g. 1200"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Grade 2 Pricing Adjust */}
                <Text style={[styles.subSectionHeader, isDarkMode && styles.textWhite]}>GRADE 2 PRICING</Text>
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Selling Price (Ksh):</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      keyboardType="decimal-pad"
                      value={adjPriceG2}
                      onChangeText={setAdjPriceG2}
                      placeholder="e.g. 800"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Min Floor Price (Ksh):</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      keyboardType="decimal-pad"
                      value={adjMinPriceG2}
                      onChangeText={setAdjMinPriceG2}
                      placeholder="e.g. 700"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Save Price Adjustment Button */}
                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={styles.cancelFormBtn}
                    onPress={() => setShowPriceAdjustForm(false)}
                  >
                    <Text style={styles.cancelFormBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveProductBtn, { backgroundColor: '#D97706' }]}
                    onPress={handleSaveAdjustedPrices}
                  >
                    <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                    <Text style={styles.saveProductBtnText}>Save & Sync Adjusted Prices</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {/* Upload Form Box (Master Only) */}
            {role === 'MERCHANT' && showUploadForm && (
              <View style={[styles.uploadFormBox, isDarkMode && styles.uploadFormBoxDark]}>
                <View style={styles.formSectionHeader}>
                  <Ionicons name="cloud-upload" size={16} color="#0891B2" />
                  <Text style={[styles.formSectionTitle, isDarkMode && styles.textWhite]}>
                    Upload Batch Produce & Packaging Details
                  </Text>
                </View>

                {/* 1. Multiple Views Photo Picker (2 Photos per Product) */}
                <View style={styles.viewsHeaderRow}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                    Product Views (Upload 2 Photos for Multi-Angle Inspection):
                  </Text>
                  <TouchableOpacity
                    style={styles.pickBothPhotosBtn}
                    onPress={handlePickMultiplePhotos}
                  >
                    <Ionicons name="images" size={13} color="#0891B2" />
                    <Text style={styles.pickBothPhotosBtnText}>Pick 2 Photos at Once</Text>
                  </TouchableOpacity>
                </View>

                {/* Side-by-side 2 Photo Slots */}
                <View style={styles.photoSlotsRow}>
                  {/* Slot 1: Primary View */}
                  <View style={styles.photoSlotContainer}>
                    <Text style={styles.slotLabel}>View 1 (Stack / Net Overview)</Text>
                    {uploadPhotoUri1 ? (
                      <View style={styles.slotPreviewWrapper}>
                        <Image source={{ uri: uploadPhotoUri1 }} style={styles.slotPreviewImg} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.slotDeleteBtn}
                          onPress={() => setUploadPhotoUri1(null)}
                        >
                          <Ionicons name="trash" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.slotEmptyBox}>
                        <Ionicons name="image-outline" size={24} color="#94A3B8" />
                        <Text style={styles.slotEmptyText}>Primary View</Text>
                        <View style={styles.slotBtnRow}>
                          <TouchableOpacity
                            style={styles.slotActionBtn}
                            onPress={() => handlePickPhotoSlot(1, 'gallery')}
                          >
                            <Text style={styles.slotActionBtnText}>Gallery</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.slotActionBtn}
                            onPress={() => handlePickPhotoSlot(1, 'camera')}
                          >
                            <Text style={styles.slotActionBtnText}>Camera</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Slot 2: Secondary View */}
                  <View style={styles.photoSlotContainer}>
                    <Text style={styles.slotLabel}>View 2 (Bulb Size / Cross-Section)</Text>
                    {uploadPhotoUri2 ? (
                      <View style={styles.slotPreviewWrapper}>
                        <Image source={{ uri: uploadPhotoUri2 }} style={styles.slotPreviewImg} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.slotDeleteBtn}
                          onPress={() => setUploadPhotoUri2(null)}
                        >
                          <Ionicons name="trash" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.slotEmptyBox}>
                        <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                        <Text style={styles.slotEmptyText}>Close-up View</Text>
                        <View style={styles.slotBtnRow}>
                          <TouchableOpacity
                            style={styles.slotActionBtn}
                            onPress={() => handlePickPhotoSlot(2, 'gallery')}
                          >
                            <Text style={styles.slotActionBtnText}>Gallery</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.slotActionBtn}
                            onPress={() => handlePickPhotoSlot(2, 'camera')}
                          >
                            <Text style={styles.slotActionBtnText}>Camera</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Product Title */}
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                    Product Title / Name:
                  </Text>
                  <TextInput
                    style={[styles.input, isDarkMode && styles.inputDark]}
                    value={uploadTitle}
                    onChangeText={setUploadTitle}
                    placeholder="e.g. Tanzania Red Bombay"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Origin & Hauling Truck Plate */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <View style={styles.labelWithHint}>
                      <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                        Produce Origin:
                      </Text>
                      <Text style={styles.fieldHint}>(1-2 words)</Text>
                    </View>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={uploadOrigin}
                      onChangeText={setUploadOrigin}
                      placeholder="e.g. Singida, Tanzania"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                      Hauling Truck Plate:
                    </Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={uploadTruckPlate}
                      onChangeText={setUploadTruckPlate}
                      placeholder="e.g. KDE 421B"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Packaging Presets */}
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Packaging Type Presets:</Text>
                  <View style={styles.pkgChipRow}>
                    {(['100KG', '50KG', '25KG', '10KG', 'CUSTOM'] as const).map(preset => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.pkgChip,
                          packagingPreset === preset && styles.pkgChipActive,
                        ]}
                        onPress={() => handleSelectPackagingPreset(preset)}
                      >
                        <Text
                          style={[
                            styles.pkgChipText,
                            packagingPreset === preset && styles.pkgChipTextActive,
                          ]}
                        >
                          {preset === 'CUSTOM' ? '⚡ Custom Kg' : `${preset} Net`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Custom Weight (in KGs) & Custom Packaging Label */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <View style={styles.labelWithHint}>
                      <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Package Weight:</Text>
                      <Text style={styles.fieldHint}>(Custom Kg)</Text>
                    </View>
                    <View style={styles.inputWithSuffix}>
                      <TextInput
                        style={[styles.input, styles.inputFlex, isDarkMode && styles.inputDark]}
                        keyboardType="decimal-pad"
                        value={uploadWeightKg}
                        onChangeText={handleCustomWeightChange}
                        placeholder="e.g. 100"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={styles.inputSuffix}>KG</Text>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Packaging Label:</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={uploadPackagingName}
                      onChangeText={setUploadPackagingName}
                      placeholder="e.g. 100KG NET"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Grade 1 Pricing & Stock Section */}
                <View style={styles.gradeSectionCard}>
                  <View style={styles.gradeSectionHeader}>
                    <View style={styles.grade1Badge}>
                      <Text style={styles.gradeBadgeText}>GRADE 1</Text>
                    </View>
                    <Text style={[styles.gradeSectionTitle, isDarkMode && styles.textWhite]}>
                      Grade 1 Wholesale Pricing & Available Stock
                    </Text>
                  </View>

                  <View style={styles.rowThreeCols}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Selling Price:</Text>
                      <TextInput
                        style={[styles.input, isDarkMode && styles.inputDark]}
                        keyboardType="decimal-pad"
                        value={uploadPricePerBag}
                        onChangeText={setUploadPricePerBag}
                        placeholder="1300"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Min Floor Price:</Text>
                      <TextInput
                        style={[styles.input, isDarkMode && styles.inputDark]}
                        keyboardType="decimal-pad"
                        value={uploadMinPrice}
                        onChangeText={setUploadMinPrice}
                        placeholder="1200"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Opening Units:</Text>
                      <TextInput
                        style={[styles.input, isDarkMode && styles.inputDark]}
                        keyboardType="number-pad"
                        value={uploadAvailableBags}
                        onChangeText={setUploadAvailableBags}
                        placeholder="350"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>

                {/* Grade 2 Toggle & Pricing Section */}
                <View style={styles.gradeSectionCard}>
                  <TouchableOpacity
                    style={styles.grade2ToggleHeader}
                    onPress={() => setHasGrade2Stock(!hasGrade2Stock)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={hasGrade2Stock ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={hasGrade2Stock ? '#0891B2' : '#94A3B8'}
                    />
                    <Text style={[styles.grade2ToggleLabel, isDarkMode && styles.textWhite]}>
                      Batch Also Includes Grade 2 Stock & Pricing
                    </Text>
                  </TouchableOpacity>

                  {hasGrade2Stock && (
                    <View style={styles.rowThreeCols}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>G2 Price (Ksh):</Text>
                        <TextInput
                          style={[styles.input, isDarkMode && styles.inputDark]}
                          keyboardType="decimal-pad"
                          value={uploadPriceGrade2}
                          onChangeText={setUploadPriceGrade2}
                          placeholder="800"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>G2 Min Floor:</Text>
                        <TextInput
                          style={[styles.input, isDarkMode && styles.inputDark]}
                          keyboardType="decimal-pad"
                          value={uploadMinPriceGrade2}
                          onChangeText={setUploadMinPriceGrade2}
                          placeholder="700"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>G2 Units:</Text>
                        <TextInput
                          style={[styles.input, isDarkMode && styles.inputDark]}
                          keyboardType="number-pad"
                          value={uploadStockGrade2}
                          onChangeText={setUploadStockGrade2}
                          placeholder="20"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>
                  )}
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Produce Description:</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, isDarkMode && styles.inputDark]}
                    multiline
                    numberOfLines={2}
                    value={uploadDescription}
                    onChangeText={setUploadDescription}
                    placeholder="e.g. Dry cured thin papery scales, thick pungent cloves, low rot index."
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Promotional Tags */}
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Promotional Badges / Tags:</Text>
                  <View style={styles.tagsSelectRow}>
                    {availableTagsList.map(t => {
                      const selected = uploadTags.includes(t);
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.tagSelectChip, selected && styles.tagSelectChipActive]}
                          onPress={() => toggleTag(t)}
                        >
                          <Text style={[styles.tagSelectChipText, selected && styles.tagSelectChipTextActive]}>
                            {selected ? '✓ ' : '+ '}{t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={styles.cancelFormBtn}
                    onPress={() => setShowUploadForm(false)}
                  >
                    <Text style={styles.cancelFormBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveProductBtn}
                    onPress={handleSaveProduct}
                  >
                    <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                    <Text style={styles.saveProductBtnText}>Save Product to Batch</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* List of Batch Products */}
            <View style={styles.listSectionHeader}>
              <Text style={[styles.listSectionTitle, isDarkMode && styles.textWhite]}>
                PRODUCE PACKS IN THIS BATCH ({batchProducts.length})
              </Text>
              <Text style={styles.listSectionSubtitle}>
                Place of Origin: <Text style={{ fontWeight: '800' }}>{getDefaultOrigin()}</Text> • Hauling Truck: <Text style={{ fontWeight: '800' }}>{currentBatch?.truckPlate || 'KDE 421B'}</Text>
              </Text>
            </View>

            {batchProducts.length > 0 ? (
              batchProducts.map((prod) => {
                const pricePerKg = Math.round(prod.pricePerBag / (prod.weightKg || 1));
                const photos = (prod.photoUrls && prod.photoUrls.length > 0) ? prod.photoUrls : [prod.photoUrl];
                const activePhotoIdx = cardPhotoIndexes[prod.id] || 0;
                const activePhoto = photos[activePhotoIdx] || prod.photoUrl;

                return (
                  <View key={prod.id} style={[styles.productCard, isDarkMode && styles.productCardDark]}>
                    {/* Multi-View Image with Badges & View Switcher */}
                    <View style={styles.cardImageWrapper}>
                      <Image source={{ uri: activePhoto }} style={styles.cardImage} resizeMode="cover" />
                      
                      {/* Top Badges */}
                      <View style={styles.cardImageBadges}>
                        <View style={[styles.gradeBadge, prod.grade === 'GRADE_1' ? styles.grade1Badge : styles.grade2Badge]}>
                          <Text style={styles.gradeBadgeText}>
                            {prod.grade === 'GRADE_1' ? 'GRADE 1' : 'GRADE 2'}
                          </Text>
                        </View>
                        <View style={styles.stockBadge}>
                          <Text style={styles.stockBadgeText}>{prod.availableBags} units</Text>
                        </View>
                      </View>

                      {/* Multiple Views Switcher Overlay (View 1 & View 2) */}
                      {photos.length > 1 && (
                        <View style={styles.multiViewOverlay}>
                          <View style={styles.viewsIndicatorBadge}>
                            <Ionicons name="camera" size={10} color="#FFFFFF" />
                            <Text style={styles.viewsIndicatorText}>{photos.length} Views</Text>
                          </View>
                          <View style={styles.viewThumbnailsRow}>
                            {photos.map((photoUri, pIdx) => (
                              <TouchableOpacity
                                key={pIdx}
                                style={[
                                  styles.viewThumbBtn,
                                  activePhotoIdx === pIdx && styles.viewThumbBtnActive,
                                ]}
                                onPress={() => setCardPhotoIndexes(prev => ({ ...prev, [prod.id]: pIdx }))}
                              >
                                <Text
                                  style={[
                                    styles.viewThumbText,
                                    activePhotoIdx === pIdx && styles.viewThumbTextActive,
                                  ]}
                                >
                                  View {pIdx + 1}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Content Details */}
                    <View style={styles.cardContent}>
                      {/* Tags */}
                      <View style={styles.cardTagsRow}>
                        {prod.tags.map((t) => {
                          const tagStyle = getTagStyle(t);
                          return (
                            <View key={t} style={[styles.tagPill, { backgroundColor: tagStyle.bg, borderColor: tagStyle.border }]}>
                              <Text style={[styles.tagPillText, { color: tagStyle.text }]}>{t}</Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Title */}
                      <Text style={[styles.cardTitle, isDarkMode && styles.textWhite]}>
                        {prod.title}
                      </Text>

                      {/* Custom Packaging, Weight in KGs, and Origin */}
                      <View style={styles.cardSpecRow}>
                        <View style={styles.specBadge}>
                          <Ionicons name="cube-outline" size={11} color="#0891B2" />
                          <Text style={styles.specBadgeText}>
                            {prod.packaging} ({prod.weightKg} kg)
                          </Text>
                        </View>
                        <View style={[styles.specBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                          <Ionicons name="location-outline" size={11} color="#059669" />
                          <Text style={[styles.specBadgeText, { color: '#059669' }]}>
                            {prod.origin}
                          </Text>
                        </View>
                      </View>

                      {/* Description */}
                      {prod.description && (
                        <Text style={[styles.cardDesc, isDarkMode && { color: '#CBD5E1' }]} numberOfLines={2}>
                          {prod.description}
                        </Text>
                      )}

                      {/* Pricing Info */}
                      <View style={styles.cardPricingRow}>
                        <View>
                          <Text style={styles.cardPriceLabel}>WHOLESALE PRICE</Text>
                          <Text style={[styles.cardPriceValue, { color: prod.grade === 'GRADE_1' ? '#0891B2' : '#D97706' }]}>
                            Ksh {prod.pricePerBag.toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.unitPriceBadge}>
                          <Text style={styles.unitPriceBadgeText}>~Ksh {pricePerKg}/kg</Text>
                        </View>
                      </View>

                      {/* Bottom Action Controls */}
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.quickLogActionBtn}
                          onPress={() => {
                            onClose();
                            if (onSelectProductForSale) onSelectProductForSale(prod);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="cart" size={14} color="#FFFFFF" />
                          <Text style={styles.quickLogActionBtnText}>Log Sale</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.shareAdvertActionBtn}
                          onPress={() => handleShareAdvert(prod)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="share-social-outline" size={14} color="#0891B2" />
                          <Text style={styles.shareAdvertActionBtnText}>Share Advert</Text>
                        </TouchableOpacity>

                        {/* Delete Button (Master or Authorized Staff) */}
                        <TouchableOpacity
                          style={styles.deleteProductActionBtn}
                          onPress={() => handleDeleteProduct(prod.id, prod.title)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>

                      {/* Remove Finished Product Button when Stock is Zero */}
                      {role === 'MERCHANT' && prod.availableBags === 0 && (
                        <TouchableOpacity
                          style={styles.removeFinishedProductBtn}
                          onPress={() => handleDeleteProduct(prod.id, prod.title)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-bin" size={14} color="#FFFFFF" />
                          <Text style={styles.removeFinishedProductBtnText}>
                            Stock Finished — Remove Product Entirely
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyText}>No products added to this batch yet.</Text>
                {role === 'MERCHANT' && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setShowUploadForm(true)}
                  >
                    <Text style={styles.emptyAddBtnText}>+ Upload First Product</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Dismiss */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
              <Text style={styles.dismissBtnText}>Close Modal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 12,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    maxHeight: '92%',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  modalCardDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFEFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    marginTop: 6,
  },

  // Upload Trigger Bar
  uploadTriggerBar: {
    marginTop: 10,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 8,
  },
  uploadToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  uploadToggleBtnActive: {
    backgroundColor: '#64748B',
  },
  uploadToggleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adjustPricesToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  adjustPricesToggleBtnActive: {
    backgroundColor: '#92400E',
  },
  adjustPricesToggleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Price Adjustment Box
  priceAdjustFormBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  subSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    marginTop: 8,
    marginBottom: 6,
    letterSpacing: 0.5,
  },

  // Upload Form
  uploadFormBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  uploadFormBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0891B2',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  labelWithHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 10,
    color: '#0891B2',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 3,
  },

  // 2 Photo Slots (Multiple Views)
  viewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pickBothPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pickBothPhotosBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
  },
  photoSlotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  photoSlotContainer: {
    flex: 1,
  },
  slotLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  slotPreviewWrapper: {
    position: 'relative',
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0891B2',
  },
  slotPreviewImg: {
    width: '100%',
    height: '100%',
  },
  slotDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotEmptyBox: {
    height: 100,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  slotEmptyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 4,
  },
  slotBtnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  slotActionBtn: {
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotActionBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0891B2',
  },

  formGroup: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  inputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  inputFlex: {
    flex: 1,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputSuffix: {
    position: 'absolute',
    right: 10,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  calcUnitPriceText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0891B2',
    marginTop: 2,
  },
  textArea: {
    height: 52,
    textAlignVertical: 'top',
  },
  gradeSegmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gradeSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  gradeSegmentBtnActiveG1: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  gradeSegmentBtnActiveG2: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  gradeSegmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  gradeSegmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pkgChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pkgChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  pkgChipActive: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  pkgChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  pkgChipTextActive: {
    color: '#FFFFFF',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 8,
  },
  tagsSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  tagSelectChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagSelectChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tagSelectChipText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  tagSelectChipTextActive: {
    color: '#059669',
    fontWeight: '800',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  saveProductBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 9,
    borderRadius: 6,
  },
  saveProductBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // List Section
  listSectionHeader: {
    marginTop: 6,
    marginBottom: 8,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  listSectionSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },

  // Product Cards in Modal
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  productCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardImageWrapper: {
    height: 155,
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  grade1Badge: {
    backgroundColor: '#0891B2',
  },
  grade2Badge: {
    backgroundColor: '#D97706',
  },
  gradeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  stockBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Multi-view Overlay on Image
  multiViewOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewsIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  viewsIndicatorText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  viewThumbnailsRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 3,
    borderRadius: 6,
  },
  viewThumbBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewThumbBtnActive: {
    backgroundColor: '#0891B2',
  },
  viewThumbText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  viewThumbTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  cardContent: {
    padding: 12,
  },
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSpecRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
  },
  cardDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
    lineHeight: 15,
  },
  cardPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardPriceLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
  },
  cardPriceValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  unitPriceBadge: {
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unitPriceBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  quickLogActionBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0891B2',
    paddingVertical: 8,
    borderRadius: 6,
  },
  quickLogActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shareAdvertActionBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0891B2',
    paddingVertical: 8,
    borderRadius: 6,
  },
  shareAdvertActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  deleteProductActionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  emptyAddBtn: {
    marginTop: 10,
    backgroundColor: '#0891B2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  modalFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dismissBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  rowThreeCols: {
    flexDirection: 'row',
    gap: 6,
  },
  gradeSectionCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gradeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gradeSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    flex: 1,
  },
  grade2ToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  grade2ToggleLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  removeFinishedProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  removeFinishedProductBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
});

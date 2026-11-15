// ============================================================================
// The Gem: Batch Produce, Photos & Packaging Modal
// Displays the view list of all produce items, images, descriptions, pricing,
// and packaging relating to this batch.
// Allows setting custom package size in KGs, custom origin, uploading multiple
// views (2 photos) per product from device, and deleting uploaded products.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../constants/theme';
import { useAppStore } from '../../store/useAppStore';
import { BatchProduct, ProduceGrade } from '../../types';
import { ImageLightboxModal, LightboxImageItem } from './ImageLightboxModal';

interface BatchProduceModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectProductForSale?: (product: BatchProduct) => void;
  isDarkMode?: boolean;
  initialMode?: 'view' | 'add' | 'prices';
  batchId?: string | null;
}

export const BatchProduceModal: React.FC<BatchProduceModalProps> = ({
  visible,
  onClose,
  onSelectProductForSale,
  isDarkMode = false,
  initialMode = 'view',
  batchId = null,
}) => {
  const { 
    currentBatch: storeCurrentBatch,
    historicalBatches,
    role, 
    batchProducts: allBatchProducts, 
    addBatchProduct, 
    deleteBatchProduct,
    createProductAndBatch,
    updateBatchPricing,
    updateBatchDetails,
    updateBatchProduct,
  } = useAppStore();

  const currentBatch =
    (batchId
      ? [storeCurrentBatch, ...historicalBatches].find((b) => b?.id === batchId)
      : storeCurrentBatch) ?? storeCurrentBatch;

  const batchProducts = currentBatch
    ? allBatchProducts.filter((p) => p.batchId === currentBatch.id)
    : allBatchProducts;

  // Upload Form, Price Adjustment & Master Batch Edit Visibility
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPriceAdjustForm, setShowPriceAdjustForm] = useState(false);
  const [showEditBatchForm, setShowEditBatchForm] = useState(false);

  // Master Batch Metadata Edit States
  const [editTruckPlate, setEditTruckPlate] = useState(currentBatch?.truckPlate || '');
  const [editOrigin, setEditOrigin] = useState(currentBatch?.origin?.regionName || '');
  const [editQualityNotes, setEditQualityNotes] = useState(currentBatch?.qualityNotes || '');

  // Master Per-Product Edit States
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdTitle, setEditProdTitle] = useState('');
  const [editProdWeightKg, setEditProdWeightKg] = useState('20');
  const [editProdPackaging, setEditProdPackaging] = useState('20KG NET');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdMinPrice, setEditProdMinPrice] = useState('');
  const [editProdDescription, setEditProdDescription] = useState('');

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

  // Per-card active photo view index & Grade 1/2 switch per batch
  const [cardPhotoIndexes, setCardPhotoIndexes] = useState<Record<string, number>>({});
  const [cardGradeSelection, setCardGradeSelection] = useState<Record<string, 'GRADE_1' | 'GRADE_2'>>({});
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const savingProductLockRef = useRef(false);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [lightboxState, setLightboxState] = useState<{
    visible: boolean;
    images: LightboxImageItem[];
    initialIndex: number;
  }>({ visible: false, images: [], initialIndex: 0 });

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
  const [packagingPreset, setPackagingPreset] = useState<'20KG' | 'CUSTOM'>('20KG');
  const [uploadPackagingName, setUploadPackagingName] = useState('20KG NET');
  const [uploadWeightKg, setUploadWeightKg] = useState('20');
  const [uploadPricePerBag, setUploadPricePerBag] = useState('1300');
  const [uploadMinPrice, setUploadMinPrice] = useState('1200');
  const [uploadAvailableBags, setUploadAvailableBags] = useState('350');
  const [uploadDescription, setUploadDescription] = useState('');

  // Grade 2 Configuration
  const [hasGrade2Stock, setHasGrade2Stock] = useState(true);
  const [uploadPriceGrade2, setUploadPriceGrade2] = useState('800');
  const [uploadMinPriceGrade2, setUploadMinPriceGrade2] = useState('700');
  const [uploadStockGrade2, setUploadStockGrade2] = useState('20');
  const [uploadWeightKgGrade2, setUploadWeightKgGrade2] = useState('20');
  const [uploadSizesGrade2, setUploadSizesGrade2] = useState<string[]>(['Medium Size']);
  const [uploadDescriptionGrade2, setUploadDescriptionGrade2] = useState('');
  
  // Multiple Views (View 1 & View 2) for Grade 1 and Grade 2
  const [uploadPhotoUri1, setUploadPhotoUri1] = useState<string | null>(null);
  const [uploadPhotoUri2, setUploadPhotoUri2] = useState<string | null>(null);
  const [uploadPhotoUriG2_1, setUploadPhotoUriG2_1] = useState<string | null>(null);
  const [uploadPhotoUriG2_2, setUploadPhotoUriG2_2] = useState<string | null>(null);
  const [uploadTags, setUploadTags] = useState<string[]>(['New Stock', 'Grade 1', 'Cured Dry']);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);
  const [advertPreviewProduct, setAdvertPreviewProduct] = useState<BatchProduct | null>(null);

  const resetUploadFormForNewBatch = () => {
    setUploadTitle('');
    setUploadOrigin('');
    setUploadTruckPlate('');
    setUploadGrade('GRADE_1');
    setPackagingPreset('20KG');
    setUploadPackagingName('20KG NET');
    setUploadWeightKg('20');
    setUploadPricePerBag('');
    setUploadMinPrice('');
    setUploadAvailableBags('');
    setUploadDescription('');
    setHasGrade2Stock(true);
    setUploadPriceGrade2('');
    setUploadMinPriceGrade2('');
    setUploadStockGrade2('');
    setUploadWeightKgGrade2('20');
    setUploadSizesGrade2(['Medium Size']);
    setUploadDescriptionGrade2('');
    setUploadPhotoUri1(null);
    setUploadPhotoUri2(null);
    setUploadPhotoUriG2_1(null);
    setUploadPhotoUriG2_2(null);
    setUploadTags(['New Stock', 'Grade 1', 'Cured Dry']);
    setUploadStep(1);
  };

  useEffect(() => {
    if (!visible) return;
    if (initialMode === 'add') {
      resetUploadFormForNewBatch();
      setShowUploadForm(true);
      setShowPriceAdjustForm(false);
      setShowEditBatchForm(false);
    } else if (initialMode === 'prices') {
      setShowPriceAdjustForm(true);
      setShowUploadForm(false);
      setShowEditBatchForm(false);
    } else {
      setShowUploadForm(false);
      setShowPriceAdjustForm(false);
      setShowEditBatchForm(false);
    }
  }, [visible, initialMode]);

  // Sync price adjustment defaults when batch changes
  useEffect(() => {
    if (currentBatch) {
      if (currentBatch.pricePerBagGrade1) setAdjPriceG1(currentBatch.pricePerBagGrade1.toString());
      if (currentBatch.minPriceGrade1) setAdjMinPriceG1(currentBatch.minPriceGrade1.toString());
      if (currentBatch.pricePerBagGrade2) setAdjPriceG2(currentBatch.pricePerBagGrade2.toString());
      if (currentBatch.minPriceGrade2) setAdjMinPriceG2(currentBatch.minPriceGrade2.toString());
    }
  }, [currentBatch]);

  // Convert picked ImagePicker asset into a portable data URI so it syncs across all devices
  const assetToSyncUri = (asset: ImagePicker.ImagePickerAsset): string => {
    if (asset.base64) {
      const mime = asset.mimeType || 'image/jpeg';
      return `data:${mime};base64,${asset.base64}`;
    }
    return asset.uri;
  };

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
          quality: 0.45,
          base64: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = assetToSyncUri(result.assets[0]);
          if (slot === 1) setUploadPhotoUri1(uri);
          else setUploadPhotoUri2(uri);
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
          quality: 0.45,
          base64: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = assetToSyncUri(result.assets[0]);
          if (slot === 1) setUploadPhotoUri1(uri);
          else setUploadPhotoUri2(uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open device photo picker.');
    }
  };

  // Image Picker for Grade 2 Specific View Slot (View 1 or View 2)
  const handlePickGrade2PhotoSlot = async (slot: 1 | 2, mode: 'gallery' | 'camera') => {
    try {
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Camera access is required to take Grade 2 photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.45,
          base64: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = assetToSyncUri(result.assets[0]);
          if (slot === 1) setUploadPhotoUriG2_1(uri);
          else setUploadPhotoUriG2_2(uri);
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Denied', 'Gallery access is needed to select Grade 2 photos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.45,
          base64: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = assetToSyncUri(result.assets[0]);
          if (slot === 1) setUploadPhotoUriG2_1(uri);
          else setUploadPhotoUriG2_2(uri);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open Grade 2 photo picker.');
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
        quality: 0.45,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (result.assets[0]) setUploadPhotoUri1(assetToSyncUri(result.assets[0]));
        if (result.assets[1]) setUploadPhotoUri2(assetToSyncUri(result.assets[1]));
      }
    } catch {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  // Packaging Preset Selection (20KG primary preset + Custom Kg)
  const handleSelectPackagingPreset = (preset: '20KG' | 'CUSTOM') => {
    setPackagingPreset(preset);
    if (preset === '20KG') {
      setUploadWeightKg('20');
      setUploadPackagingName('20KG NET');
      setUploadPricePerBag('1300');
    } else {
      setUploadPackagingName(`${uploadWeightKg || '20'}KG CUSTOM NET`);
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
  const handleSaveProduct = async () => {
    if (savingProductLockRef.current || isSavingProduct) return;
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

    const photosG2: string[] = [];
    if (uploadPhotoUriG2_1) photosG2.push(uploadPhotoUriG2_1);
    if (uploadPhotoUriG2_2) photosG2.push(uploadPhotoUriG2_2);

    const finalOrigin = uploadOrigin.trim() || getDefaultOrigin();
    const finalPackaging = uploadPackagingName.trim() || `${weight}KG NET`;
    const finalTruck = uploadTruckPlate.trim().toUpperCase() || currentBatch?.truckPlate || 'KDE 421B';
    const minPriceG1 = Math.max(0, parseFloat(uploadMinPrice) || Math.round(price * 0.9));
    const priceG2 = hasGrade2Stock ? Math.max(0, parseFloat(uploadPriceGrade2) || 0) : 0;
    const minPriceG2 = hasGrade2Stock ? Math.max(0, parseFloat(uploadMinPriceGrade2) || Math.round(priceG2 * 0.9)) : 0;
    const stockG2 = hasGrade2Stock ? Math.max(0, Math.floor(parseInt(uploadStockGrade2, 10)) || 0) : 0;
    const savedTitle = uploadTitle.trim();

    savingProductLockRef.current = true;
    setIsSavingProduct(true);
    try {
      await createProductAndBatch({
        title: savedTitle,
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
        weightKgGrade2: hasGrade2Stock ? (parseFloat(uploadWeightKgGrade2) || weight) : undefined,
        sizesGrade2: hasGrade2Stock ? uploadSizesGrade2 : undefined,
        descriptionGrade2: hasGrade2Stock ? uploadDescriptionGrade2.trim() || undefined : undefined,
        photoUrlsGrade2: hasGrade2Stock && photosG2.length > 0 ? photosG2 : undefined,
        photoUrls: photos,
        description: uploadDescription.trim() || `Cured onions in ${finalPackaging} (${weight} kg).`,
        tags: uploadTags.length > 0 ? uploadTags : ['New Stock', 'Grade 1', 'Cured Dry'],
      });

      // Reset Form
      setUploadTitle('');
      setUploadPhotoUri1(null);
      setUploadPhotoUri2(null);
      setUploadPhotoUriG2_1(null);
      setUploadPhotoUriG2_2(null);
      setUploadDescription('');
      setUploadDescriptionGrade2('');
      setShowUploadForm(false);
      Alert.alert(
        '✅ Product & Batch Created',
        `"${savedTitle}" (${weight} kg, ${finalOrigin}) on truck ${finalTruck} is now live and persisted.\n\nGrade 1: Ksh ${price.toLocaleString()} (Min Floor: Ksh ${minPriceG1.toLocaleString()})\n${hasGrade2Stock ? `Grade 2: Ksh ${priceG2.toLocaleString()} (Min Floor: Ksh ${minPriceG2.toLocaleString()})\n` : ''}Active for all seller terminals.`
      );
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'Could not save batch and products to server. Please check connection and try again.'
      );
    } finally {
      savingProductLockRef.current = false;
      setIsSavingProduct(false);
    }
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

  // Master Edit Batch Metadata (Truck Plate, Origin, Quality Notes)
  const handleOpenEditBatch = () => {
    setEditTruckPlate(currentBatch?.truckPlate || '');
    setEditOrigin(currentBatch?.origin?.regionName || '');
    setEditQualityNotes(currentBatch?.qualityNotes || '');
    setShowEditBatchForm(!showEditBatchForm);
    if (!showEditBatchForm) {
      setShowUploadForm(false);
      setShowPriceAdjustForm(false);
    }
  };

  const handleSaveBatchEdit = async () => {
    if (!editTruckPlate.trim() || !editOrigin.trim()) {
      Alert.alert('Missing Fields', 'Truck plate and origin cannot be empty.');
      return;
    }
    try {
      await updateBatchDetails({
        truckPlate: editTruckPlate.trim().toUpperCase(),
        originRegionName: editOrigin.trim(),
        qualityNotes: editQualityNotes.trim(),
      });
      setShowEditBatchForm(false);
      Alert.alert('✅ Batch Updated', 'Batch truck plate, origin, and notes saved.');
    } catch (err) {
      Alert.alert('Update Failed', err instanceof Error ? err.message : 'Could not update batch.');
    }
  };

  // Master Per-Product Edit
  const startEditProduct = (prod: BatchProduct) => {
    setEditingProductId(prod.id);
    setEditProdTitle(prod.title);
    setEditProdWeightKg(String(prod.weightKg || 20));
    setEditProdPackaging(prod.packaging || '20KG NET');
    setEditProdPrice(String(prod.pricePerBag));
    setEditProdMinPrice(String(prod.minPrice ?? prod.pricePerBag));
    setEditProdDescription(prod.description || '');
  };

  const handleSaveProductEdit = async (prod: BatchProduct) => {
    const p = parseFloat(editProdPrice);
    const mp = parseFloat(editProdMinPrice);
    const w = parseFloat(editProdWeightKg);
    if (!editProdTitle.trim() || isNaN(p) || p <= 0 || isNaN(w) || w <= 0) {
      Alert.alert('Invalid Fields', 'Please enter a valid title, weight (kg), and selling price.');
      return;
    }
    try {
      await updateBatchProduct(prod.id, {
        title: editProdTitle.trim(),
        packaging: editProdPackaging.trim() || `${w}KG NET`,
        weightKg: w,
        pricePerBag: p,
        minPrice: isNaN(mp) || mp <= 0 ? p : mp,
        description: editProdDescription.trim(),
      });
      if (prod.grade === 'GRADE_1') {
        await updateBatchPricing({
          pricePerBagGrade1: p,
          minPriceGrade1: isNaN(mp) || mp <= 0 ? p : mp,
        });
      } else {
        await updateBatchPricing({
          pricePerBagGrade2: p,
          minPriceGrade2: isNaN(mp) || mp <= 0 ? p : mp,
        });
      }
      setEditingProductId(null);
      Alert.alert('✅ Product Updated', `"${editProdTitle.trim()}" saved and synced.`);
    } catch (err) {
      Alert.alert('Update Failed', err instanceof Error ? err.message : 'Could not update product.');
    }
  };

  // Delete Product Confirmation (opens legible bottom alert container)
  const handleDeleteProduct = (productId: string, productTitle: string) => {
    setPendingDeleteProduct({ id: productId, title: productTitle });
  };

  const confirmDeleteProduct = async () => {
    if (!pendingDeleteProduct || isDeletingProduct) return;
    setIsDeletingProduct(true);
    try {
      await deleteBatchProduct(pendingDeleteProduct.id);
      setPendingDeleteProduct(null);
    } catch (err) {
      Alert.alert('Delete Failed', err instanceof Error ? err.message : 'Could not remove product.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleAdvanceToGrade2 = () => {
    if (!uploadTitle.trim()) {
      Alert.alert('Missing Field', 'Please provide the produce/seed name for Grade 1 before continuing.');
      return;
    }
    const price = parseFloat(uploadPricePerBag);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid Grade 1 price before continuing.');
      return;
    }
    const weight = parseFloat(uploadWeightKg);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid Grade 1 package weight in KGs.');
      return;
    }
    setUploadStep(2);
  };

  // Share Advert Preview & Customer CTA Push
  const handleShareAdvert = (prod: BatchProduct) => {
    setAdvertPreviewProduct(prod);
  };

  const executePushAdvert = async (prod: BatchProduct) => {
    const pricePerKg = Math.round(prod.pricePerBag / (prod.weightKg || 1));
    const cleanTitle = prod.title.replace(/\s*\(Grade\s*[12]\)\s*$/i, '').trim();
    const gradeLabel = prod.grade === 'GRADE_1' ? 'GRADE 1' : 'GRADE 2';
    const activePhoto = (prod.photoUrls && prod.photoUrls[0]) || prod.photoUrl;
    const msg =
      `🔥 *FRESH ONION STOCK — ORDER NOW!* 🔥\n\n` +
      `🧅 *${cleanTitle}* (${gradeLabel})\n` +
      `📦 Package: ${prod.weightKg}kg Net (${prod.packaging})\n` +
      `💰 Whole Package Price: *Ksh ${prod.pricePerBag.toLocaleString()}* (Ksh ${pricePerKg}/kg)\n` +
      `📊 Units Left: *${prod.availableBags} nets available*\n` +
      `📍 Origin: ${prod.origin} • Truck: ${currentBatch?.truckPlate || 'Wakulima'}\n\n` +
      `👉 *TAP TO RESERVE YOUR NETS TODAY AT WAKULIMA MARKET!* Limited stock — first come, first served!`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator && activePhoto) {
        try {
          const resp = await fetch(activePhoto);
          const blob = await resp.blob();
          const file = new File([blob], `${cleanTitle.replace(/\s+/g, '-').toLowerCase()}-advert.jpg`, {
            type: blob.type || 'image/jpeg',
          });
          if ('canShare' in navigator && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `${cleanTitle} (${gradeLabel}) - Wholesale Offer`,
              text: msg,
            });
            return;
          }
        } catch {
          // Fall through to standard Share.share
        }
      }
      await Share.share({
        message: msg,
        url: activePhoto,
        title: `${cleanTitle} (${gradeLabel}) - Wakulima Wholesale`,
      });
    } catch {
      Alert.alert('Share Error', 'Could not open share dialogue.');
    }
  };

  const getHashtagColor = (tag: string, dark: boolean) => {
    switch (tag) {
      case 'New Stock':
        return dark ? '#6EE7B7' : '#065F46';
      case 'Discounted':
        return dark ? '#FCA5A5' : '#991B1B';
      case 'Large Size':
        return dark ? '#C4B5FD' : '#5B21B6';
      case 'Medium Size':
        return dark ? '#7DD3FC' : '#075985';
      case 'Small Size':
        return dark ? '#FDE68A' : '#92400E';
      case 'Grade 1':
        return dark ? '#5EEAD4' : '#0F766E';
      case 'Grade 2':
        return dark ? '#FDBA74' : '#C2410C';
      default:
        return dark ? '#CFE9EC' : '#334155';
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
  const previewWeight = parseFloat(uploadWeightKg) || 20;
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
          <View style={[styles.modalHeader, isDarkMode && styles.modalHeaderDark]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.modalHeaderMetaText, isDarkMode && { color: '#F0FDFA' }]}>
                {showUploadForm
                  ? 'Add New Batch'
                  : `${currentBatch?.batchNumber || 'WB-20261022-01'} • ${currentBatch?.truckPlate || 'KDE 421B'} • ${getDefaultOrigin()}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDarkMode ? '#CFE9EC' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Master Action Trigger Bar (Upload Product & Adjust Selling Prices) */}
          {role === 'MERCHANT' && (
            <View style={styles.uploadTriggerBar}>
              <TouchableOpacity
                style={[styles.uploadToggleBtn, showUploadForm && styles.uploadToggleBtnActive]}
                onPress={() => {
                  const next = !showUploadForm;
                  setShowUploadForm(next);
                  if (next) {
                    resetUploadFormForNewBatch();
                    setShowPriceAdjustForm(false);
                    setShowEditBatchForm(false);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showUploadForm ? 'close-circle' : 'add-circle'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.uploadToggleBtnText}>
                  {showUploadForm ? 'Close' : '+ Add Batch'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.adjustPricesToggleBtn, showPriceAdjustForm && styles.adjustPricesToggleBtnActive]}
                onPress={() => {
                  setShowPriceAdjustForm(!showPriceAdjustForm);
                  if (!showPriceAdjustForm) {
                    setShowUploadForm(false);
                    setShowEditBatchForm(false);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showPriceAdjustForm ? 'close-circle' : 'options'}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.adjustPricesToggleBtnText}>
                  {showPriceAdjustForm ? 'Close' : 'Prices'}
                </Text>
              </TouchableOpacity>

              {currentBatch && (
                <TouchableOpacity
                  style={[styles.editBatchToggleBtn, showEditBatchForm && styles.editBatchToggleBtnActive]}
                  onPress={handleOpenEditBatch}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={showEditBatchForm ? 'close-circle' : 'create-outline'}
                    size={15}
                    color="#FFFFFF"
                  />
                  <Text style={styles.adjustPricesToggleBtnText}>
                    {showEditBatchForm ? 'Close' : 'Edit Batch'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Edit Batch Metadata Form (Master Only) */}
            {role === 'MERCHANT' && showEditBatchForm && currentBatch && (
              <View style={[styles.uploadFormBox, isDarkMode && styles.uploadFormBoxDark]}>
                <View style={styles.formSectionHeader}>
                  <Ionicons name="create-outline" size={16} color={isDarkMode ? '#FDE68A' : '#0891B2'} />
                  <Text style={[styles.formSectionTitle, isDarkMode && { color: '#F0FDFA' }]}>
                    Edit Batch Details ({currentBatch.batchNumber})
                  </Text>
                </View>
                <View style={styles.rowTwoCols}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Truck Plate:</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={editTruckPlate}
                      onChangeText={setEditTruckPlate}
                      placeholder="e.g. KDG 582C"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Origin:</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={editOrigin}
                      onChangeText={setEditOrigin}
                      placeholder="e.g. Singida, Tanzania"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Batch Notes:</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, isDarkMode && styles.inputDark]}
                    multiline
                    numberOfLines={2}
                    value={editQualityNotes}
                    onChangeText={setEditQualityNotes}
                    placeholder="Quality or delivery notes..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.formActionRow}>
                  <TouchableOpacity
                    style={[styles.cancelFormBtn, isDarkMode && styles.cancelFormBtnDark]}
                    onPress={() => setShowEditBatchForm(false)}
                  >
                    <Text style={[styles.cancelFormBtnText, isDarkMode && { color: '#CFE9EC' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveProductBtn} onPress={handleSaveBatchEdit}>
                    <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                    <Text style={styles.saveProductBtnText}>Save Batch Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
                    {uploadStep === 1 ? 'Step 1: Finalize Grade 1 & Batch Info' : 'Step 2: Configure Grade 2 (Optional)'}
                  </Text>
                </View>

                {/* Clear 2-Step Separation Bar */}
                <View style={styles.stepPillRow}>
                  <TouchableOpacity
                    style={[styles.stepPill, uploadStep === 1 && styles.stepPillActive]}
                    onPress={() => setUploadStep(1)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stepPillText, uploadStep === 1 && styles.stepPillTextActive]}>
                      1. Grade 1 Product
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stepPill, uploadStep === 2 && styles.stepPillActive]}
                    onPress={handleAdvanceToGrade2}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stepPillText, uploadStep === 2 && styles.stepPillTextActive]}>
                      2. Grade 2 Product
                    </Text>
                  </TouchableOpacity>
                </View>

                {uploadStep === 1 && (
                  <>
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

                {/* Packaging Presets (20KG Net primary + Custom Kg) */}
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Packaging Type:</Text>
                  <View style={styles.pkgChipRow}>
                    {(['20KG', 'CUSTOM'] as const).map(preset => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.pkgChip,
                          isDarkMode && styles.pkgChipDark,
                          packagingPreset === preset && styles.pkgChipActive,
                        ]}
                        onPress={() => handleSelectPackagingPreset(preset)}
                      >
                        <Text
                          style={[
                            styles.pkgChipText,
                            isDarkMode && { color: '#CFE9EC' },
                            packagingPreset === preset && styles.pkgChipTextActive,
                          ]}
                        >
                          {preset === 'CUSTOM' ? '⚡ Custom Kg' : '20KG Net'}
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
                      <Text style={[styles.fieldHint, isDarkMode && { color: '#FDE68A' }]}>(Custom Kg)</Text>
                    </View>
                    <View style={styles.inputWithSuffix}>
                      <TextInput
                        style={[styles.input, styles.inputFlex, isDarkMode && styles.inputDark]}
                        keyboardType="decimal-pad"
                        value={uploadWeightKg}
                        onChangeText={handleCustomWeightChange}
                        placeholder="e.g. 20"
                        placeholderTextColor="#94A3B8"
                      />
                      <Text style={[styles.inputSuffix, isDarkMode && { color: '#B4D6D9' }]}>KG</Text>
                    </View>
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Packaging Label:</Text>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.inputDark]}
                      value={uploadPackagingName}
                      onChangeText={setUploadPackagingName}
                      placeholder="e.g. 20KG NET"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Grade 1 Pricing & Stock Section */}
                <View style={[styles.gradeSectionCard, isDarkMode && styles.gradeSectionCardDark]}>
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
                  </>
                )}

                {uploadStep === 2 && (
                  <>
                {/* Grade 2 Toggle & Pricing Section */}
                <View style={[styles.gradeSectionCard, isDarkMode && styles.gradeSectionCardDark]}>
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
                    <View>
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

                      <View style={styles.rowTwoCols}>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                          <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>G2 Packaging (KG):</Text>
                          <View style={styles.inputWithSuffix}>
                            <TextInput
                              style={[styles.input, styles.inputFlex, isDarkMode && styles.inputDark]}
                              keyboardType="decimal-pad"
                              value={uploadWeightKgGrade2}
                              onChangeText={setUploadWeightKgGrade2}
                              placeholder="20"
                              placeholderTextColor="#94A3B8"
                            />
                            <Text style={[styles.inputSuffix, isDarkMode && { color: '#B4D6D9' }]}>KG</Text>
                          </View>
                        </View>

                        <View style={[styles.formGroup, { flex: 1.5 }]}>
                          <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>G2 Bulb Size (Check all that apply):</Text>
                          <View style={styles.pkgChipRow}>
                            {(['Large Size', 'Medium Size', 'Small Size'] as const).map((sz) => {
                              const checked = uploadSizesGrade2.includes(sz);
                              return (
                                <TouchableOpacity
                                  key={sz}
                                  style={[
                                    styles.pkgChip,
                                    isDarkMode && styles.pkgChipDark,
                                    checked && styles.pkgChipActive,
                                    { flexDirection: 'row', alignItems: 'center', gap: 4 },
                                  ]}
                                  onPress={() =>
                                    setUploadSizesGrade2((prev) =>
                                      prev.includes(sz) ? prev.filter((item) => item !== sz) : [...prev, sz]
                                    )
                                  }
                                >
                                  <Ionicons
                                    name={checked ? 'checkbox' : 'square-outline'}
                                    size={14}
                                    color={checked ? '#FFFFFF' : isDarkMode ? '#CFE9EC' : '#475569'}
                                  />
                                  <Text
                                    style={[
                                      styles.pkgChipText,
                                      isDarkMode && { color: '#CFE9EC' },
                                      checked && styles.pkgChipTextActive,
                                    ]}
                                  >
                                    {sz.replace(' Size', '')}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                          Grade 2 Condition / Description:
                        </Text>
                        <TextInput
                          style={[styles.input, styles.textArea, isDarkMode && styles.inputDark]}
                          multiline
                          numberOfLines={2}
                          value={uploadDescriptionGrade2}
                          onChangeText={setUploadDescriptionGrade2}
                          placeholder="e.g. Smaller cured bulbs, dry papery skin, good for quick retail turnover."
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      {/* Grade 2 Photos (Distinct from Grade 1) */}
                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>
                          Grade 2 Photos (Optional — Distinct from Grade 1):
                        </Text>
                        <View style={styles.photoSlotsRow}>
                          <View style={styles.photoSlotContainer}>
                            <Text style={[styles.slotLabel, isDarkMode && { color: '#CFE9EC' }]}>G2 View 1</Text>
                            {uploadPhotoUriG2_1 ? (
                              <View style={styles.slotPreviewWrapper}>
                                <Image source={{ uri: uploadPhotoUriG2_1 }} style={styles.slotPreviewImg} resizeMode="cover" />
                                <TouchableOpacity style={styles.slotDeleteBtn} onPress={() => setUploadPhotoUriG2_1(null)}>
                                  <Ionicons name="trash" size={12} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.slotEmptyBox}>
                                <Ionicons name="image-outline" size={20} color="#94A3B8" />
                                <Text style={styles.slotEmptyText}>G2 Photo 1</Text>
                                <View style={styles.slotBtnRow}>
                                  <TouchableOpacity style={styles.slotActionBtn} onPress={() => handlePickGrade2PhotoSlot(1, 'gallery')}>
                                    <Text style={styles.slotActionBtnText}>Gallery</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.slotActionBtn} onPress={() => handlePickGrade2PhotoSlot(1, 'camera')}>
                                    <Text style={styles.slotActionBtnText}>Camera</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>

                          <View style={styles.photoSlotContainer}>
                            <Text style={[styles.slotLabel, isDarkMode && { color: '#CFE9EC' }]}>G2 View 2</Text>
                            {uploadPhotoUriG2_2 ? (
                              <View style={styles.slotPreviewWrapper}>
                                <Image source={{ uri: uploadPhotoUriG2_2 }} style={styles.slotPreviewImg} resizeMode="cover" />
                                <TouchableOpacity style={styles.slotDeleteBtn} onPress={() => setUploadPhotoUriG2_2(null)}>
                                  <Ionicons name="trash" size={12} color="#FFFFFF" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={styles.slotEmptyBox}>
                                <Ionicons name="image-outline" size={20} color="#94A3B8" />
                                <Text style={styles.slotEmptyText}>G2 Photo 2</Text>
                                <View style={styles.slotBtnRow}>
                                  <TouchableOpacity style={styles.slotActionBtn} onPress={() => handlePickGrade2PhotoSlot(2, 'gallery')}>
                                    <Text style={styles.slotActionBtnText}>Gallery</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.slotActionBtn} onPress={() => handlePickGrade2PhotoSlot(2, 'camera')}>
                                    <Text style={styles.slotActionBtnText}>Camera</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                  </>
                )}

                {uploadStep === 1 && (
                  <>
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
                  </>
                )}

                {/* Action Buttons */}
                {uploadStep === 1 ? (
                  <View style={styles.formActionRow}>
                    <TouchableOpacity
                      style={styles.cancelFormBtn}
                      onPress={() => setShowUploadForm(false)}
                    >
                      <Text style={styles.cancelFormBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveProductBtn}
                      onPress={handleAdvanceToGrade2}
                    >
                      <Text style={styles.saveProductBtnText}>Next: Grade 2</Text>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.formActionRow}>
                    <TouchableOpacity
                      style={styles.cancelFormBtn}
                      onPress={() => setUploadStep(1)}
                      disabled={isSavingProduct}
                    >
                      <Text style={styles.cancelFormBtnText}>← Back to G1</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.saveProductBtn, isSavingProduct && { opacity: 0.65 }]}
                      onPress={handleSaveProduct}
                      disabled={isSavingProduct}
                    >
                      {isSavingProduct ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.saveProductBtnText}>Saving...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                          <Text style={styles.saveProductBtnText}>Save Batch & Products</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* List of Batch Products (hidden when adding a new batch) */}
            {!showUploadForm && (batchProducts.length > 0 ? (
              (() => {
                const groups = new Map<string, { batchId: string; g1?: BatchProduct; g2?: BatchProduct }>();
                for (const p of batchProducts) {
                  const bid = p.batchId ?? p.id;
                  const existing = groups.get(bid) ?? { batchId: bid };
                  if (p.grade === 'GRADE_1') existing.g1 = existing.g1 ?? p;
                  else existing.g2 = existing.g2 ?? p;
                  groups.set(bid, existing);
                }
                return Array.from(groups.values());
              })().map(({ batchId, g1, g2 }) => {
                const hasBothGrades = Boolean(g1 && g2);
                const selectedGrade = cardGradeSelection[batchId] ?? (g1 ? 'GRADE_1' : 'GRADE_2');
                const prod = (selectedGrade === 'GRADE_2' ? g2 : g1) ?? g1 ?? g2!;
                const pricePerKg = Math.round(prod.pricePerBag / (prod.weightKg || 1));
                const photos = (prod.photoUrls && prod.photoUrls.length > 0) ? prod.photoUrls : [prod.photoUrl];
                const activePhotoIdx = cardPhotoIndexes[prod.id] || 0;
                const activePhoto = photos[activePhotoIdx] || prod.photoUrl;

                return (
                  <View key={batchId} style={[styles.productCard, isDarkMode && styles.productCardDark]}>
                    {/* Multi-View Image with Badges, Grade Switch & View Switcher */}
                    <View style={styles.cardImageWrapper}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() =>
                          setLightboxState({
                            visible: true,
                            images: photos.map((uri, i) => ({
                              uri,
                              label: `${prod.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} • View ${i + 1}`,
                            })),
                            initialIndex: activePhotoIdx,
                          })
                        }
                      >
                        <Image source={{ uri: activePhoto }} style={styles.cardImage} resizeMode="cover" />
                      </TouchableOpacity>
                      
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

                      {/* Grade 1 / Grade 2 Switch & View 1 / View 2 Overlay */}
                      {(photos.length > 1 || hasBothGrades) && (
                        <View style={styles.multiViewOverlay}>
                          {hasBothGrades ? (
                            <View style={styles.viewThumbnailsRow}>
                              {(['GRADE_1', 'GRADE_2'] as const).map((gKey) => {
                                const isActiveGrade = prod.grade === gKey;
                                return (
                                  <TouchableOpacity
                                    key={gKey}
                                    style={[
                                      styles.viewThumbBtn,
                                      isActiveGrade && styles.viewThumbBtnActive,
                                    ]}
                                    onPress={() =>
                                      setCardGradeSelection((prev) => ({ ...prev, [batchId]: gKey }))
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.viewThumbText,
                                        isActiveGrade && styles.viewThumbTextActive,
                                      ]}
                                    >
                                      {gKey === 'GRADE_1' ? 'Grade 1' : 'Grade 2'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={styles.viewsIndicatorBadge}>
                              <Ionicons name="camera" size={10} color="#FFFFFF" />
                              <Text style={styles.viewsIndicatorText}>{photos.length} Views</Text>
                            </View>
                          )}

                          {photos.length > 1 && (
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
                          )}
                        </View>
                      )}
                    </View>

                    {/* Content Details */}
                    <View style={styles.cardContent}>
                      {/* Compact Hashtag Labels */}
                      <View style={styles.cardTagsRow}>
                        {prod.tags.map((t) => {
                          const cleanTag = t.startsWith('#') ? t.slice(1) : t;
                          return (
                            <Text
                              key={t}
                              style={[styles.hashtagText, { color: getHashtagColor(cleanTag, isDarkMode) }]}
                            >
                              #{cleanTag}
                            </Text>
                          );
                        })}
                      </View>

                      {/* Seed / Produce Name + Net Packaging */}
                      <View style={styles.cardTitleRow}>
                        <Text style={[styles.cardTitle, isDarkMode && styles.textWhite, { flex: 1 }]}>
                          {prod.title.replace(/\s*\(Grade\s*[12]\)\s*$/i, '').trim()}
                        </Text>
                        <Text style={[styles.cardNetWeight, isDarkMode && { color: '#7DD3FC' }]}>
                          {prod.weightKg}kg
                        </Text>
                      </View>

                      {/* Description */}
                      {prod.description && (
                        <Text style={[styles.cardDesc, isDarkMode && { color: '#CFE9EC' }]} numberOfLines={2}>
                          {prod.description}
                        </Text>
                      )}

                      {/* Pricing Info */}
                      <View style={[styles.cardPricingRow, isDarkMode && styles.cardPricingRowDark]}>
                        <Text
                          style={[
                            styles.cardPriceValue,
                            {
                              color: prod.grade === 'GRADE_1'
                                ? (isDarkMode ? '#38BDF8' : '#0891B2')
                                : (isDarkMode ? '#FBBF24' : '#D97706'),
                            },
                          ]}
                        >
                          Ksh {prod.pricePerBag.toLocaleString()}
                        </Text>
                        <Text style={[styles.unitPriceText, isDarkMode && { color: '#CFE9EC' }]}>
                          Ksh {pricePerKg}/kg
                        </Text>
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
                          activeOpacity={0.75}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Share advert"
                        >
                          <Ionicons
                            name="share-social-outline"
                            size={18}
                            color={isDarkMode ? '#7DD3FC' : '#0891B2'}
                          />
                        </TouchableOpacity>

                        {/* Edit Button (Master Only) */}
                        {role === 'MERCHANT' && (
                          <TouchableOpacity
                            style={styles.editProductActionBtn}
                            onPress={() =>
                              editingProductId === prod.id
                                ? setEditingProductId(null)
                                : startEditProduct(prod)
                            }
                            activeOpacity={0.8}
                          >
                            <Ionicons name="create-outline" size={14} color="#0891B2" />
                          </TouchableOpacity>
                        )}

                        {/* Delete Button (Master or Authorized Staff) */}
                        <TouchableOpacity
                          style={styles.deleteProductActionBtn}
                          onPress={() => handleDeleteProduct(prod.id, prod.title)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>

                      {/* Inline Master Edit Product Form */}
                      {role === 'MERCHANT' && editingProductId === prod.id && (
                        <View style={[styles.uploadFormBox, isDarkMode && styles.uploadFormBoxDark, { marginTop: 10 }]}>
                          <Text style={[styles.formSectionTitle, isDarkMode && { color: '#FDE68A' }, { marginBottom: 8 }]}>
                            Edit Product Details
                          </Text>
                          <View style={styles.formGroup}>
                            <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Title:</Text>
                            <TextInput
                              style={[styles.input, isDarkMode && styles.inputDark]}
                              value={editProdTitle}
                              onChangeText={setEditProdTitle}
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                          <View style={styles.rowTwoCols}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Weight (KG):</Text>
                              <TextInput
                                style={[styles.input, isDarkMode && styles.inputDark]}
                                keyboardType="decimal-pad"
                                value={editProdWeightKg}
                                onChangeText={setEditProdWeightKg}
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Packaging:</Text>
                              <TextInput
                                style={[styles.input, isDarkMode && styles.inputDark]}
                                value={editProdPackaging}
                                onChangeText={setEditProdPackaging}
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                          </View>
                          <View style={styles.rowTwoCols}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Selling Price:</Text>
                              <TextInput
                                style={[styles.input, isDarkMode && styles.inputDark]}
                                keyboardType="decimal-pad"
                                value={editProdPrice}
                                onChangeText={setEditProdPrice}
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                              <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Min Floor:</Text>
                              <TextInput
                                style={[styles.input, isDarkMode && styles.inputDark]}
                                keyboardType="decimal-pad"
                                value={editProdMinPrice}
                                onChangeText={setEditProdMinPrice}
                                placeholderTextColor="#94A3B8"
                              />
                            </View>
                          </View>
                          <View style={styles.formGroup}>
                            <Text style={[styles.fieldLabel, isDarkMode && styles.textWhite]}>Description:</Text>
                            <TextInput
                              style={[styles.input, styles.textArea, isDarkMode && styles.inputDark]}
                              multiline
                              numberOfLines={2}
                              value={editProdDescription}
                              onChangeText={setEditProdDescription}
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                          <View style={styles.formActionRow}>
                            <TouchableOpacity
                              style={[styles.cancelFormBtn, isDarkMode && styles.cancelFormBtnDark]}
                              onPress={() => setEditingProductId(null)}
                            >
                              <Text style={[styles.cancelFormBtnText, isDarkMode && { color: '#CFE9EC' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.saveProductBtn}
                              onPress={() => handleSaveProductEdit(prod)}
                            >
                              <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                              <Text style={styles.saveProductBtnText}>Save Product</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

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
                    onPress={() => {
                      resetUploadFormForNewBatch();
                      setShowUploadForm(true);
                    }}
                  >
                    <Text style={styles.emptyAddBtnText}>+ Upload First Product</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Legible Bottom Delete Confirmation Alert Container */}
          {pendingDeleteProduct && (
            <View style={[styles.deleteAlertBox, isDarkMode && styles.deleteAlertBoxDark]}>
              <TouchableOpacity
                style={[styles.deleteAlertCloseBtn, isDarkMode && styles.deleteAlertCloseBtnDark]}
                onPress={() => setPendingDeleteProduct(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close delete alert"
              >
                <Ionicons name="close" size={15} color={isDarkMode ? '#F0FDFA' : '#7F1D1D'} />
              </TouchableOpacity>
              <View style={styles.deleteAlertHeader}>
                <Ionicons name="warning" size={18} color={isDarkMode ? '#FDE68A' : '#DC2626'} />
                <Text style={[styles.deleteAlertTitle, isDarkMode && { color: '#F0FDFA' }]}>
                  Remove Product from Batch?
                </Text>
              </View>
              <Text style={[styles.deleteAlertMessage, isDarkMode && { color: '#CFE9EC' }]}>
                Are you sure you want to delete "{pendingDeleteProduct.title}"? This updates all terminals.
              </Text>
              <View style={styles.deleteAlertActions}>
                <TouchableOpacity
                  style={[styles.cancelFormBtn, isDarkMode && styles.cancelFormBtnDark]}
                  onPress={() => setPendingDeleteProduct(null)}
                  disabled={isDeletingProduct}
                >
                  <Text style={[styles.cancelFormBtnText, isDarkMode && { color: '#F0FDFA' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, isDeletingProduct && { opacity: 0.65 }]}
                  onPress={confirmDeleteProduct}
                  disabled={isDeletingProduct}
                >
                  <Text style={styles.deleteConfirmBtnText}>
                    {isDeletingProduct ? 'Deleting...' : 'Delete Product'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom Dismiss */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.dismissBtn, isDarkMode && { backgroundColor: '#1B4F55', borderWidth: 0.75, borderColor: '#7AB5BC' }]}
              onPress={onClose}
            >
              <Text style={[styles.dismissBtnText, isDarkMode && { color: '#F0FDFA' }]}>Close Modal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ImageLightboxModal
        visible={lightboxState.visible}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        onClose={() => setLightboxState((prev) => ({ ...prev, visible: false }))}
      />

      {/* Customer Advert Card Preview Modal */}
      <Modal
        visible={Boolean(advertPreviewProduct)}
        transparent
        animationType="fade"
        onRequestClose={() => setAdvertPreviewProduct(null)}
      >
        {advertPreviewProduct && (() => {
          const ap = advertPreviewProduct;
          const apPhoto = (ap.photoUrls && ap.photoUrls[0]) || ap.photoUrl;
          const apTitle = ap.title.replace(/\s*\(Grade\s*[12]\)\s*$/i, '').trim();
          const apPricePerKg = Math.round(ap.pricePerBag / (ap.weightKg || 1));
          return (
            <View style={styles.advertModalBackdrop}>
              <View style={[styles.advertPreviewCard, isDarkMode && styles.advertPreviewCardDark]}>
                <View style={styles.advertCardHeader}>
                  <Text style={styles.advertHeaderTag}>CUSTOMER WHOLESALE ADVERT</Text>
                  <TouchableOpacity
                    onPress={() => setAdvertPreviewProduct(null)}
                    style={styles.advertCloseBtn}
                  >
                    <Ionicons name="close" size={18} color={isDarkMode ? '#F0FDFA' : '#334155'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.advertImageWrap}>
                  <Image source={{ uri: apPhoto }} style={styles.advertImage} resizeMode="cover" />
                  <View style={styles.advertImageOverlayTop}>
                    <View style={[styles.gradeBadge, ap.grade === 'GRADE_1' ? styles.grade1Badge : styles.grade2Badge]}>
                      <Text style={styles.gradeBadgeText}>
                        {ap.grade === 'GRADE_1' ? 'GRADE 1' : 'GRADE 2'}
                      </Text>
                    </View>
                    <View style={styles.stockBadge}>
                      <Text style={styles.stockBadgeText}>{ap.availableBags} units left</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.advertBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={[styles.advertTitle, isDarkMode && styles.textWhite, { flex: 1 }]}>
                      {apTitle}
                    </Text>
                    <Text style={[styles.cardNetWeight, isDarkMode && { color: '#7DD3FC' }]}>
                      {ap.weightKg}kg Net
                    </Text>
                  </View>
                  <Text style={[styles.advertOriginText, isDarkMode && { color: '#CFE9EC' }]}>
                    Origin: {ap.origin} • Truck {currentBatch?.truckPlate || 'Wakulima'}
                  </Text>
                  <View style={styles.advertPriceRow}>
                    <Text style={[styles.advertPriceValue, isDarkMode && { color: '#FDE68A' }]}>
                      Ksh {ap.pricePerBag.toLocaleString()}
                    </Text>
                    <Text style={[styles.advertPerKgText, isDarkMode && { color: '#CFE9EC' }]}>
                      Ksh {apPricePerKg}/kg • Whole Package
                    </Text>
                  </View>

                  <View style={styles.advertCtaBanner}>
                    <Ionicons name="megaphone" size={16} color="#FFFFFF" />
                    <Text style={styles.advertCtaBannerText}>
                      FRESH STOCK AVAILABLE NOW! Order your {ap.weightKg}kg nets today — limited units left!
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.advertPushBtn}
                    onPress={() => executePushAdvert(ap)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="share-social" size={16} color="#FFFFFF" />
                    <Text style={styles.advertPushBtnText}>Push Advert to Customers</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>
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
    backgroundColor: '#1D575D',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderDark: {
    borderBottomColor: '#1E293B',
  },
  modalHeaderMetaText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
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
  editBatchToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0F766E',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editBatchToggleBtnActive: {
    backgroundColor: '#115E59',
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
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
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
    backgroundColor: '#1D575D',
    borderColor: 'rgba(122, 181, 188, 0.5)',
    color: '#F0FDFA',
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
  pkgChipDark: {
    backgroundColor: '#1D575D',
    borderColor: 'rgba(122, 181, 188, 0.5)',
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
  cancelFormBtnDark: {
    backgroundColor: '#1D575D',
    borderWidth: 0.75,
    borderColor: 'rgba(122, 181, 188, 0.5)',
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
    gap: 8,
    marginBottom: 6,
  },
  hashtagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardNetWeight: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0891B2',
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
  cardPricingRowDark: {
    borderTopColor: '#1E293B',
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
  unitPriceText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  shareAdvertActionBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0891B2',
  },
  editProductActionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    alignItems: 'center',
    justifyContent: 'center',
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
  gradeSectionCardDark: {
    backgroundColor: '#256A71',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
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
  deleteAlertBox: {
    position: 'relative',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.25,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    paddingRight: 40,
    marginTop: 8,
    marginBottom: 4,
  },
  deleteAlertBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#EE6C4D',
  },
  deleteAlertCloseBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(153, 27, 27, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAlertCloseBtnDark: {
    backgroundColor: 'rgba(240, 253, 250, 0.15)',
  },
  deleteAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deleteAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  deleteAlertMessage: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#7F1D1D',
    marginBottom: 10,
  },
  deleteAlertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteConfirmBtn: {
    flex: 1.5,
    backgroundColor: '#DC2626',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stepPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  stepPillActive: {
    backgroundColor: '#0891B2',
  },
  stepPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },
  advertModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'center',
    padding: 18,
  },
  advertPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#0891B2',
  },
  advertPreviewCardDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#FDE68A',
  },
  advertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  advertHeaderTag: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0891B2',
    letterSpacing: 0.6,
  },
  advertCloseBtn: {
    padding: 4,
  },
  advertImageWrap: {
    position: 'relative',
    width: '100%',
    height: 190,
  },
  advertImage: {
    width: '100%',
    height: '100%',
  },
  advertImageOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  advertBody: {
    padding: 14,
  },
  advertTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  advertOriginText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 3,
  },
  advertPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  advertPriceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0891B2',
  },
  advertPerKgText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  advertCtaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  advertCtaBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 16,
  },
  advertPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  advertPushBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});

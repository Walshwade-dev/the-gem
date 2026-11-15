// ============================================================================
// The Gem: Produce Listing & Advert Card
// Packaging variants, produce photos, stock status, and promotional badges
// ============================================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

export interface ProduceListingItem {
  id: string;
  title: string;
  grade: 'GRADE_1' | 'GRADE_2';
  packaging: '100KG_NET' | '50KG_BAG' | '10KG_POCKET' | string;
  weightKg: number;
  pricePerBag: number;
  minPrice?: number;
  availableBags: number;
  origin: string;
  photoUrl: string;
  photoUrls?: string[];
  tags: string[];
}

interface ProduceListingCardProps {
  item: ProduceListingItem;
  onQuickLog: (item: ProduceListingItem) => void;
  onDeleteProduct?: (item: ProduceListingItem) => void;
  role?: 'MERCHANT' | 'SELLER';
  isDarkMode?: boolean;
}

export const ProduceListingCard: React.FC<ProduceListingCardProps> = ({
  item,
  onQuickLog,
  onDeleteProduct,
  role = 'MERCHANT',
  isDarkMode = false,
}) => {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const photos = (item.photoUrls && item.photoUrls.length > 0) ? item.photoUrls : [item.photoUrl];
  const currentPhoto = photos[activePhotoIdx] || item.photoUrl;

  const pricePerKg = Math.round(item.pricePerBag / (item.weightKg || 1));

  const handleShareAdvert = async () => {
    const msg = `🧅 *WAKULIMA WHOLESALE ONIONS - THE GEM* 🧅\n` +
      `📦 Produce: ${item.title} (${item.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'})\n` +
      `⚖️ Packaging: ${item.packaging.replace('_', ' ')} (${item.weightKg} kg)\n` +
      `💰 Price: Ksh ${item.pricePerBag.toLocaleString()} (~Ksh ${pricePerKg}/kg)\n` +
      `🚚 Origin: ${item.origin}\n` +
      `📍 Location: Wakulima Market (Marikiti), Nairobi\n` +
      `⚡ Available Stock: ${item.availableBags} units. Fast collection coordination available!`;

    try {
      await Share.share({ message: msg, title: 'Wakulima Onion Wholesale' });
    } catch {
      Alert.alert('Share Error', 'Could not open share dialog.');
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

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      {/* Produce Image with Tag Overlays */}
      <View style={styles.imageWrapper}>
        <Image source={{ uri: currentPhoto }} style={styles.image} resizeMode="cover" />
        <View style={styles.badgeRow}>
          <View style={[styles.gradePill, item.grade === 'GRADE_1' ? styles.grade1Pill : styles.grade2Pill]}>
            <Text style={styles.gradePillText}>{item.grade === 'GRADE_1' ? 'GRADE 1' : 'GRADE 2'}</Text>
          </View>
          <View style={[styles.stockPill, item.availableBags === 0 && styles.stockPillZero]}>
            <Ionicons name="cube" size={11} color="#FFFFFF" />
            <Text style={styles.stockPillText}>
              {item.availableBags === 0 ? '0 left (Out of Stock)' : `${item.availableBags} left`}
            </Text>
          </View>
        </View>

        {/* Multi-view image switcher if 2+ views available */}
        {photos.length > 1 && (
          <View style={styles.multiPhotoSwitcher}>
            {photos.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.switcherDot, activePhotoIdx === idx && styles.switcherDotActive]}
                onPress={() => setActivePhotoIdx(idx)}
              >
                <Text style={[styles.switcherText, activePhotoIdx === idx && styles.switcherTextActive]}>
                  View {idx + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Card Content Body */}
      <View style={styles.content}>
        {/* Tags Row */}
        <View style={styles.tagsContainer}>
          {item.tags.map((tag) => {
            const style = getTagStyle(tag);
            return (
              <View key={tag} style={[styles.tagPill, { backgroundColor: style.bg, borderColor: style.border }]}>
                <Text style={[styles.tagText, { color: style.text }]}>{tag}</Text>
              </View>
            );
          })}
        </View>

        {/* Title & Origin */}
        <Text style={[styles.title, isDarkMode && styles.textWhite]}>{item.title}</Text>
        <Text style={[styles.originText, isDarkMode && { color: '#CFE9EC' }]}>
          📍 Origin: {item.origin} • {item.packaging.replace('_', ' ')}
        </Text>

        {/* Pricing Info */}
        <View style={[styles.pricingRow, isDarkMode && styles.pricingRowDark]}>
          <View>
            <Text style={[styles.priceLabel, isDarkMode && { color: '#CFE9EC' }]}>WHOLESALE PRICE</Text>
            <Text style={[styles.priceValue, isDarkMode && { color: '#7DD3FC' }]}>
              Ksh {item.pricePerBag.toLocaleString()}
            </Text>
            {item.minPrice !== undefined && item.minPrice > 0 ? (
              <Text style={[styles.minFloorText, isDarkMode && { color: '#FDE68A' }]}>
                Min Floor: Ksh {item.minPrice.toLocaleString()}
              </Text>
            ) : null}
          </View>
          <View style={[styles.unitPriceBox, isDarkMode && styles.unitPriceBoxDark]}>
            <Text style={[styles.unitPriceText, isDarkMode && { color: '#7DD3FC' }]}>~Ksh {pricePerKg} / kg</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.quickLogBtn, isDarkMode && styles.quickLogBtnDark]}
            onPress={() => onQuickLog(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
            <Text style={styles.quickLogBtnText}>Log Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareAdvertBtn, isDarkMode && styles.shareAdvertBtnDark]}
            onPress={handleShareAdvert}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={16} color={isDarkMode ? '#38BDF8' : '#0891B2'} />
            <Text style={[styles.shareAdvertBtnText, isDarkMode && { color: '#38BDF8' }]}>Share Advert</Text>
          </TouchableOpacity>

          {role === 'MERCHANT' && onDeleteProduct && item.availableBags > 0 && (
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={() => onDeleteProduct(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Prominent Remove Button When Stock Finished to Zero */}
        {role === 'MERCHANT' && item.availableBags === 0 && onDeleteProduct && (
          <TouchableOpacity
            style={styles.removeFinishedBtn}
            onPress={() => onDeleteProduct(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-bin" size={14} color="#FFFFFF" />
            <Text style={styles.removeFinishedBtnText}>Stock Finished — Remove Product Entirely</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#256A71',
    shadowColor: '#0D2C30',
    shadowOpacity: 0.25,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gradePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
  },
  grade1Pill: {
    backgroundColor: '#0891B2',
  },
  grade2Pill: {
    backgroundColor: '#D97706',
  },
  gradePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
  },
  stockPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  multiPhotoSwitcher: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 3,
    borderRadius: 6,
  },
  switcherDot: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  switcherDotActive: {
    backgroundColor: '#0891B2',
  },
  switcherText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  switcherTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  content: {
    padding: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  originText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 12,
  },
  pricingRowDark: {
    backgroundColor: '#1B4F55',
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0891B2',
  },
  unitPriceBox: {
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitPriceBoxDark: {
    backgroundColor: '#256A71',
  },
  unitPriceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickLogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md, // 12px
  },
  quickLogBtnDark: {
    backgroundColor: '#0284C7',
  },
  quickLogBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareAdvertBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#0891B2',
  },
  shareAdvertBtnDark: {
    backgroundColor: '#1B4F55',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
  },
  shareAdvertBtnText: {
    color: '#0891B2',
    fontSize: 14,
    fontWeight: '700',
  },
  minFloorText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
    marginTop: 2,
  },
  stockPillZero: {
    backgroundColor: '#DC2626',
  },
  deleteIconBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  removeFinishedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    marginTop: 10,
  },
  removeFinishedBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

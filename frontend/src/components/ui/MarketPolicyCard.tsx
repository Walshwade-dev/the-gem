// ============================================================================
// The Gem: Market Policy Cards
// Official operational & statutory rules for Wakulima Market wholesale suite
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

export interface MarketPolicy {
  id: string;
  title: string;
  category: 'STATUTORY' | 'CREDIT' | 'QUALITY' | 'OPERATIONS';
  ruleNumber: string;
  summary: string;
  requirement: string;
  penaltyNotice?: string;
}

interface MarketPolicyCardProps {
  policy: MarketPolicy;
  isDarkMode?: boolean;
}

export const MarketPolicyCard: React.FC<MarketPolicyCardProps> = ({
  policy,
  isDarkMode = false,
}) => {
  const getCategoryMeta = (cat: MarketPolicy['category']) => {
    switch (cat) {
      case 'STATUTORY':
        return { icon: 'shield-checkmark', color: '#0891B2', bg: '#ECFEFF', label: 'COUNTY & TAX' };
      case 'CREDIT':
        return { icon: 'time', color: '#D97706', bg: '#FEF3C7', label: 'CREDIT GOVERNANCE' };
      case 'QUALITY':
        return { icon: 'nutrition', color: '#059669', bg: '#D1FAE5', label: 'PRODUCE STANDARDS' };
      default:
        return { icon: 'business', color: '#6366F1', bg: '#EEF2FF', label: 'MARKET PROTOCOL' };
    }
  };

  const meta = getCategoryMeta(policy.category);

  return (
    <View style={[styles.card, isDarkMode && styles.cardDark]}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.categoryBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={13} color={meta.color} />
            <Text style={[styles.categoryText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={[styles.ruleNumber, isDarkMode && { color: '#94A3B8' }]}>RULE {policy.ruleNumber}</Text>
        </View>
        <Text style={[styles.title, isDarkMode && styles.textWhite]}>{policy.title}</Text>
      </View>

      <Text style={[styles.summary, isDarkMode && { color: '#CBD5E1' }]}>{policy.summary}</Text>

      {/* Mandatory Requirement Inset Box */}
      <View style={[styles.requirementBox, isDarkMode && styles.requirementBoxDark]}>
        <View style={styles.reqTitleRow}>
          <Ionicons name="alert-circle" size={14} color="#0891B2" />
          <Text style={[styles.reqTitle, isDarkMode && { color: '#38BDF8' }]}>MANDATORY REQUIREMENT</Text>
        </View>
        <Text style={[styles.reqText, isDarkMode && { color: '#F1F5F9' }]}>{policy.requirement}</Text>
      </View>

      {policy.penaltyNotice && (
        <View style={styles.penaltyRow}>
          <Ionicons name="warning-outline" size={12} color="#DC2626" />
          <Text style={styles.penaltyText}>{policy.penaltyNotice}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg, // 16px
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    borderWidth: 0.75,
    shadowColor: '#0D2C30',
  },
  header: {
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ruleNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    marginBottom: 12,
  },
  requirementBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    marginBottom: 8,
  },
  requirementBoxDark: {
    backgroundColor: '#1B4F55',
    borderColor: 'rgba(122, 181, 188, 0.45)',
    borderWidth: 0.75,
  },
  reqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reqTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.5,
  },
  reqText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#0F172A',
  },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  penaltyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});

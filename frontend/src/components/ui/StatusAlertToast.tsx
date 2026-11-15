// ============================================================================
// The Gem: Status & Feedback Alert Components
// Success toasts, informational notices, and alert banners from design reference
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

export interface AlertToastProps {
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message?: string;
  onDismiss?: () => void;
  isDarkMode?: boolean;
}

export const StatusAlertToast: React.FC<AlertToastProps> = ({
  type,
  title,
  message,
  onDismiss,
  isDarkMode = false,
}) => {
  const getConfig = () => {
    switch (type) {
      case 'SUCCESS':
        return {
          icon: 'checkmark-circle' as const,
          color: '#059669',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          darkBg: '#064E3B',
          darkBorder: '#059669',
        };
      case 'WARNING':
        return {
          icon: 'warning' as const,
          color: '#D97706',
          bg: '#FFFBEB',
          border: '#FDE68A',
          darkBg: '#2E1E05',
          darkBorder: '#B45309',
        };
      case 'ERROR':
        return {
          icon: 'alert-circle' as const,
          color: '#DC2626',
          bg: '#FEF2F2',
          border: '#FECACA',
          darkBg: '#450A0A',
          darkBorder: '#EF4444',
        };
      default:
        return {
          icon: 'information-circle' as const,
          color: '#0891B2',
          bg: '#ECFEFF',
          border: '#A5F3FC',
          darkBg: '#164E63',
          darkBorder: '#0891B2',
        };
    }
  };

  const config = getConfig();

  return (
    <View
      style={[
        styles.toastCard,
        {
          backgroundColor: isDarkMode ? config.darkBg : config.bg,
          borderColor: isDarkMode ? config.darkBorder : config.border,
        },
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.color} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDarkMode && styles.textWhite]}>{title}</Text>
        {message ? (
          <Text style={[styles.message, isDarkMode && { color: '#E2E8F0' }]}>{message}</Text>
        ) : null}
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color={isDarkMode ? '#CBD5E1' : '#64748B'} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md, // 12px
    borderWidth: 1.5,
    marginHorizontal: 14,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  message: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 4,
  },
});

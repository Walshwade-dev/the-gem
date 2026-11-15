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
          color: isDarkMode ? '#6EE7B7' : '#059669',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          darkBg: '#1B4F55',
          darkBorder: '#6EE7B7',
        };
      case 'WARNING':
        return {
          icon: 'warning' as const,
          color: isDarkMode ? '#FDE68A' : '#D97706',
          bg: '#FFFBEB',
          border: '#FDE68A',
          darkBg: '#1B4F55',
          darkBorder: '#FDE68A',
        };
      case 'ERROR':
        return {
          icon: 'alert-circle' as const,
          color: isDarkMode ? '#FCA5A5' : '#DC2626',
          bg: '#FEF2F2',
          border: '#FECACA',
          darkBg: '#451A1A',
          darkBorder: '#EE6C4D',
        };
      default:
        return {
          icon: 'information-circle' as const,
          color: isDarkMode ? '#FDE68A' : '#0891B2',
          bg: '#ECFEFF',
          border: '#A5F3FC',
          darkBg: '#1B4F55',
          darkBorder: '#7AB5BC',
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
      <Ionicons name={config.icon} size={20} color={config.color} style={styles.leadingIcon} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDarkMode && { color: '#F0FDFA' }]}>{title}</Text>
        {message ? (
          <Text style={[styles.message, isDarkMode && { color: '#CFE9EC' }]}>{message}</Text>
        ) : null}
      </View>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={[styles.closeBtn, isDarkMode && styles.closeBtnDark]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss alert"
        >
          <Ionicons name="close" size={15} color={isDarkMode ? '#F0FDFA' : '#334155'} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toastCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md, // 12px
    borderWidth: 1.25,
    marginHorizontal: 14,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  leadingIcon: {
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  textWhite: {
    color: '#F0FDFA',
  },
  message: {
    fontSize: 11.5,
    color: '#334155',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  closeBtnDark: {
    backgroundColor: 'rgba(240, 253, 250, 0.14)',
  },
});

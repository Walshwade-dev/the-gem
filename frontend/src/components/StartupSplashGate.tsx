import React, { useEffect, useState } from 'react';
import { Appearance, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getApiBaseUrl } from '../services/api';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

// Keep native OS splash visible until JS splash view mounts
SplashScreen.preventAutoHideAsync().catch(() => {});

const FIXED_SPLASH_MS = 2200;

export function StartupSplashGate({ children }: { children: React.ReactNode }) {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const syncSystemTheme = useAppStore((s) => s.syncSystemTheme);

  const [overlayVisible, setOverlayVisible] = useState(true);
  const [statusLabel, setStatusLabel] = useState('Launching...');

  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.92);
  const logoFloatY = useSharedValue(0);
  const haloScale = useSharedValue(0.88);
  const haloOpacity = useSharedValue(0.35);

  // Keep store synced with OS dark/light theme changes unless manually overridden
  useEffect(() => {
    syncSystemTheme(Appearance.getColorScheme());
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      syncSystemTheme(colorScheme);
    });
    return () => sub.remove();
  }, [syncSystemTheme]);

  // Start smooth 60fps UI-thread logo animation & hide native splash
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    logoFloatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(4, { duration: 1300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0.9, { duration: 1400, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );

    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.18, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [haloOpacity, haloScale, logoFloatY, logoScale]);

  // Fixed-timing splash animation for consistent launch; warm backend silently in background
  useEffect(() => {
    let active = true;
    const healthUrl = `${getApiBaseUrl()}/health`;
    void fetch(healthUrl, { method: 'GET' }).catch(() => undefined);

    const splashTimer = setTimeout(() => {
      if (!active) return;
      containerOpacity.value = withTiming(
        0,
        { duration: 360, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(setOverlayVisible)(false);
          }
        }
      );
    }, FIXED_SPLASH_MS);

    return () => {
      active = false;
      clearTimeout(splashTimer);
    };
  }, [containerOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }, { translateY: logoFloatY.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));

  const bgColor = isDarkMode ? '#1D575D' : THEME.colors.background;
  const titleColor = isDarkMode ? '#F0FDFA' : THEME.colors.primaryDark;
  const subtitleColor = isDarkMode ? '#BAE6FD' : THEME.colors.textSecondary;
  const haloColor = isDarkMode ? '#22D3EE' : '#0891B2';

  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>
      {children}
      {overlayVisible && (
        <Animated.View
          pointerEvents="auto"
          style={[styles.overlay, { backgroundColor: bgColor }, containerStyle]}
        >
          <View style={styles.centerCluster}>
            <Animated.View
              style={[
                styles.halo,
                { backgroundColor: haloColor },
                haloStyle,
              ]}
            />
            <Animated.View style={logoStyle}>
              <Image
                source={require('../../assets/faceted-onion-transparent.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
          <Text style={[styles.brandTitle, { color: titleColor }]}>The Gem</Text>
          <Text style={[styles.statusText, { color: subtitleColor }]}>{statusLabel}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  centerCluster: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
  },
  logo: {
    width: 148,
    height: 148,
  },
  brandTitle: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
});

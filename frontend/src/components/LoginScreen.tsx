// ============================================================================
// The Gem: Official Dedicated Login Screen (Mobile-First)
// Merchant Username/Password & Hired Seller Assigned-Phone SMS OTP Login
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  Easing
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth, useSSO } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { THEME } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

WebBrowser.maybeCompleteAuthSession();

type LoginTab = 'MERCHANT' | 'SELLER';

const ClerkMerchantSignInForm: React.FC<{
  isDarkMode: boolean;
}> = ({ isDarkMode }) => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const { syncMasterWithClerk } = useAppStore();
  const [mode, setMode] = useState<'SIGN_IN' | 'FORGOT_EMAIL' | 'FORGOT_CODE' | 'CLIENT_TRUST_CODE'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [trustCode, setTrustCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
  }, []);

  const handleGoogleOAuth = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (isSignedIn) {
        const synced = await syncMasterWithClerk({
          email: email.trim() || undefined,
        });
        if (!synced.success) {
          setErrorMsg(synced.message);
          Alert.alert('Backend Sync Failed', synced.message);
        }
        return;
      }

      if (Platform.OS === 'web') {
        if (!isLoaded || !signIn) {
          const msg = 'Authentication is still loading. Please try again.';
          setErrorMsg(msg);
          return;
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const callbackUrl = `${origin}/oauth-callback`;
        console.log('[Google OAuth Web] starting redirect with callbackUrl:', callbackUrl);
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: callbackUrl,
          redirectUrlComplete: `${origin}/`,
        });
        return;
      }

      const expoGoHost =
        Constants.expoGoConfig?.debuggerHost ??
        (Constants.executionEnvironment === ExecutionEnvironment.StoreClient
          ? Constants.expoConfig?.hostUri
          : undefined);
      const redirectUrl = expoGoHost
        ? `exp://${expoGoHost}/--/oauth-callback`
        : AuthSession.makeRedirectUri({
            scheme: 'thegem',
            path: 'oauth-callback',
          });
      console.log('[Google OAuth] starting with redirectUrl:', redirectUrl);
      const {
        createdSessionId,
        setActive: ssoSetActive,
        signIn: ssoSignIn,
        signUp: ssoSignUp,
        authSessionResult,
      } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      console.log('[Google OAuth] finished:', {
        createdSessionId: Boolean(createdSessionId),
        authSessionType: authSessionResult?.type,
        signInStatus: ssoSignIn?.status,
        signUpStatus: ssoSignUp?.status,
      });

      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        const resolvedEmail =
          ssoSignIn?.identifier ??
          ssoSignUp?.emailAddress ??
          (email.trim() || undefined);
        const fullName =
          ssoSignUp?.firstName || ssoSignUp?.lastName
            ? [ssoSignUp?.firstName, ssoSignUp?.lastName].filter(Boolean).join(' ')
            : undefined;
        const synced = await syncMasterWithClerk({
          email: resolvedEmail,
          fullName,
        });
        if (!synced.success) {
          setErrorMsg(synced.message);
          Alert.alert('Backend Sync Failed', synced.message);
        }
      } else if (authSessionResult?.type !== 'cancel' && authSessionResult?.type !== 'dismiss') {
        const msg = `Sign-In Incomplete (signIn=${ssoSignIn?.status ?? 'none'}, signUp=${ssoSignUp?.status ?? 'none'})`;
        setErrorMsg(msg);
        Alert.alert('Sign-In Incomplete', msg);
      }
    } catch (err) {
      console.error('[Google OAuth] failed:', err);
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setErrorMsg(msg);
      Alert.alert('Google Sign-In Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClerkLogin = async () => {
    setErrorMsg(null);
    if (isSignedIn) {
      setSubmitting(true);
      try {
        const synced = await syncMasterWithClerk({ email: email.trim() || undefined });
        if (!synced.success) {
          setErrorMsg(synced.message);
          Alert.alert('Backend Sync Failed', synced.message);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!isLoaded || !signIn) {
      setErrorMsg('Authentication is still loading. Please try again.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      const msg = 'Please enter your email and password.';
      setErrorMsg(msg);
      Alert.alert('Credentials Required', msg);
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password: password.trim(),
      });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        const synced = await syncMasterWithClerk({ email: email.trim() });
        if (!synced.success) {
          setErrorMsg(synced.message);
          Alert.alert('Backend Sync Failed', synced.message);
        }
      } else if (
        attempt.status === 'needs_client_trust' ||
        attempt.status === 'needs_second_factor'
      ) {
        const emailFactor = attempt.supportedSecondFactors?.find(
          (f) => f.strategy === 'email_code'
        );
        if (emailFactor && 'emailAddressId' in emailFactor && emailFactor.emailAddressId) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
          });
          setTrustCode('');
          setMode('CLIENT_TRUST_CODE');
          Alert.alert(
            'Verify New Device',
            `A 6-digit verification code has been sent to ${email.trim()}.`
          );
        } else {
          const msg = `Second factor required (${attempt.status}), but email_code is not available.`;
          setErrorMsg(msg);
          Alert.alert('Verification Required', msg);
        }
      } else {
        const msg = `Additional Verification Required (Status: ${attempt.status})`;
        setErrorMsg(msg);
        Alert.alert('Additional Verification Required', `Status: ${attempt.status}`);
      }
    } catch (err) {
      console.error('[Clerk Email Login] failed:', err);
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Clerk.';
      setErrorMsg(msg);
      Alert.alert('Sign-In Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your Master email address.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setMode('FORGOT_CODE');
      Alert.alert('Reset Code Sent', `Check ${email.trim()} for your 6-digit password reset code.`);
    } catch (err) {
      Alert.alert(
        'Reset Failed',
        err instanceof Error ? err.message : 'Unable to send password reset code.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!isLoaded || !signIn) return;
    if (!resetCode.trim() || !newPassword.trim()) {
      Alert.alert('Required', 'Please enter the 6-digit code and your new password.');
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword.trim(),
      });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        const synced = await syncMasterWithClerk({ email: email.trim() });
        if (!synced.success) {
          Alert.alert('Backend Sync Failed', synced.message);
        }
      } else {
        Alert.alert('Additional Verification Required', `Status: ${attempt.status}`);
      }
    } catch (err) {
      Alert.alert(
        'Password Reset Failed',
        err instanceof Error ? err.message : 'Invalid code or weak password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyClientTrustCode = async () => {
    setErrorMsg(null);
    if (!isLoaded || !signIn) return;
    if (!trustCode.trim()) {
      const msg = 'Please enter the 6-digit verification code sent to your email.';
      setErrorMsg(msg);
      Alert.alert('Code Required', msg);
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: trustCode.trim(),
      });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        const synced = await syncMasterWithClerk({ email: email.trim() });
        if (!synced.success) {
          setErrorMsg(synced.message);
          Alert.alert('Backend Sync Failed', synced.message);
        }
      } else {
        const msg = `Verification incomplete (Status: ${attempt.status})`;
        setErrorMsg(msg);
        Alert.alert('Verification Incomplete', msg);
      }
    } catch (err) {
      console.error('[Clerk Client Trust] failed:', err);
      const msg = err instanceof Error ? err.message : 'Invalid verification code.';
      setErrorMsg(msg);
      Alert.alert('Verification Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'CLIENT_TRUST_CODE') {
    return (
      <View style={styles.tabContent}>
        <View style={styles.infoBannerMerchant}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#0E7490" />
          <Text style={styles.infoBannerTextMerchant}>
            New device verification: enter the 6-digit code sent to {email.trim()}.
          </Text>
        </View>

        {errorMsg ? (
          <View
            style={{
              backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.16)' : '#FEF2F2',
              borderColor: isDarkMode ? '#DC2626' : '#FCA5A5',
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: isDarkMode ? '#FCA5A5' : '#B91C1C', fontSize: 13, fontWeight: '600' }}>
              {errorMsg}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
            VERIFICATION CODE
          </Text>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="keypad" size={18} color="#0891B2" style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
              placeholder="6-digit code"
              placeholderTextColor={THEME.colors.textMuted}
              value={trustCode}
              onChangeText={setTrustCode}
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.merchantLoginBtn}
          onPress={handleVerifyClientTrustCode}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.merchantLoginBtnText}>
            {submitting ? 'VERIFYING...' : 'VERIFY & SIGN IN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoHelperRow}
          onPress={() => {
            setErrorMsg(null);
            setMode('SIGN_IN');
          }}
          disabled={submitting}
        >
          <Text style={styles.demoHelperText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'FORGOT_EMAIL') {
    return (
      <View style={styles.tabContent}>
        <View style={styles.infoBannerMerchant}>
          <Ionicons name="key-outline" size={16} color="#0E7490" />
          <Text style={styles.infoBannerTextMerchant}>
            Enter your Master email to receive a 6-digit password reset code.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
            MASTER EMAIL
          </Text>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="mail" size={18} color="#0891B2" style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
              placeholder="master@yourstore.co.ke"
              placeholderTextColor={THEME.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.merchantLoginBtn}
          onPress={handleSendResetCode}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
          <Text style={styles.merchantLoginBtnText}>
            {submitting ? 'SENDING CODE...' : 'SEND RESET CODE'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoHelperRow}
          onPress={() => setMode('SIGN_IN')}
        >
          <Text style={styles.demoHelperText}>Back to Master Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'FORGOT_CODE') {
    return (
      <View style={styles.tabContent}>
        <View style={styles.infoBannerMerchant}>
          <Ionicons name="mail-open-outline" size={16} color="#0E7490" />
          <Text style={styles.infoBannerTextMerchant}>
            Enter the 6-digit code sent to {email.trim()} and choose a new password.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
            RESET CODE
          </Text>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="keypad" size={18} color="#0891B2" style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
              placeholder="6-digit code"
              placeholderTextColor={THEME.colors.textMuted}
              value={resetCode}
              onChangeText={setResetCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
            NEW PASSWORD
          </Text>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="lock-closed" size={18} color="#0891B2" style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
              placeholder="Enter new password"
              placeholderTextColor={THEME.colors.textMuted}
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(prev => !prev)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showNewPassword ? 'eye-off' : 'eye'}
                size={18}
                color={isDarkMode ? '#94A3B8' : '#64748B'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.merchantLoginBtn}
          onPress={handleConfirmReset}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.merchantLoginBtnText}>
            {submitting ? 'RESETTING...' : 'RESET PASSWORD & SIGN IN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoHelperRow}
          onPress={handleSendResetCode}
          disabled={submitting}
        >
          <Text style={styles.demoHelperText}>Resend Code</Text>
          <Text style={[styles.demoHelperText, { color: '#94A3B8' }]}> • </Text>
          <Text
            style={styles.demoHelperText}
            onPress={() => setMode('SIGN_IN')}
          >
            Back to Sign In
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {errorMsg ? (
        <View
          style={{
            backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.16)' : '#FEF2F2',
            borderColor: isDarkMode ? '#DC2626' : '#FCA5A5',
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: isDarkMode ? '#FCA5A5' : '#B91C1C', fontSize: 13, fontWeight: '600' }}>
            {errorMsg}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.googleOAuthBtn,
          isDarkMode && styles.googleOAuthBtnDark,
        ]}
        onPress={handleGoogleOAuth}
        disabled={submitting}
        activeOpacity={0.82}
      >
        <Ionicons
          name="logo-google"
          size={18}
          color="#4285F4"
        />
        <Text
          style={[
            styles.googleOAuthBtnText,
            isDarkMode && { color: '#1F1F1F' },
          ]}
        >
          {submitting ? 'Connecting to Google...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      <View style={styles.orDividerRow}>
        <View style={[styles.orDividerLine, isDarkMode && { backgroundColor: '#334155' }]} />
        <Text style={[styles.orDividerText, isDarkMode && { color: '#94A3B8' }]}>
          OR SIGN IN WITH EMAIL
        </Text>
        <View style={[styles.orDividerLine, isDarkMode && { backgroundColor: '#334155' }]} />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
          MASTER EMAIL
        </Text>
        <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
          <Ionicons name="mail" size={18} color="#0891B2" style={styles.inputIcon} />
          <TextInput
            style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
            placeholder="master@yourstore.co.ke"
            placeholderTextColor={THEME.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
          PASSWORD
        </Text>
        <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
          <Ionicons name="lock-closed" size={18} color="#0891B2" style={styles.inputIcon} />
          <TextInput
            style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
            placeholder="Enter password"
            placeholderTextColor={THEME.colors.textMuted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(prev => !prev)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              color={isDarkMode ? '#94A3B8' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.merchantLoginBtn}
        onPress={handleClerkLogin}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Ionicons name="log-in" size={20} color="#FFFFFF" />
        <Text style={styles.merchantLoginBtnText}>
          {submitting ? 'SIGNING IN...' : 'LOG IN AS MASTER'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.demoHelperRow}
        onPress={() => setMode('FORGOT_EMAIL')}
      >
        <Text style={styles.demoHelperText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
};

export const LoginScreen: React.FC = () => {
  const {
    requestSellerOtp,
    verifySellerOtp,
    loginSellerWithPassphrase,
    isDarkMode
  } = useAppStore();

  const clerkConfigured = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [activeTab, setActiveTab] = useState<LoginTab>('MERCHANT');
  const [tabSelectorWidth, setTabSelectorWidth] = useState<number>(0);
  const tabSlideAnim = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(1)).current;
  const formTranslateX = useRef(new Animated.Value(0)).current;

  const switchTab = (nextTab: LoginTab) => {
    if (nextTab === activeTab) return;
    const goingToSeller = nextTab === 'SELLER';
    Animated.spring(tabSlideAnim, {
      toValue: goingToSeller ? 1 : 0,
      tension: 75,
      friction: 11,
      useNativeDriver: false,
    }).start();

    setActiveTab(nextTab);
    formOpacity.setValue(0);
    formTranslateX.setValue(goingToSeller ? 18 : -18);
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pillWidth = tabSelectorWidth > 12 ? (tabSelectorWidth - 12) / 2 : 0;
  const pillTranslateX = tabSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth + 4],
  });
  const pillColor = tabSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [THEME.colors.primary, '#D97706'],
  });

  // Sales Person Login Form State
  const [sellerPhone, setSellerPhone] = useState<string>('');
  const [sellerPassphrase, setSellerPassphrase] = useState<string>('');
  const [usePassphraseMode, setUsePassphraseMode] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [logoError, setLogoError] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleRequestSellerOtp = async () => {
    if (!sellerPhone.trim()) {
      Alert.alert('Phone Required', 'Please enter your mobile phone number.');
      return;
    }

    const res = await requestSellerOtp(sellerPhone.trim(), 'LOGIN');
    if (res.success) {
      setOtpSent(true);
      setCountdown(60);
      Alert.alert(
        '📲 SMS OTP Sent',
        `If ${sellerPhone.trim()} has an active assignment, a 6-digit OTP has been sent.`
      );
    } else {
      Alert.alert('OTP Request Failed', res.message);
    }
  };

  const handleVerifySellerOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit SMS verification code.');
      return;
    }

    const res = await verifySellerOtp(
      sellerPhone.trim(),
      otpCode.trim(),
      sellerPassphrase.trim() || undefined,
      'LOGIN'
    );
    if (!res.success) {
      Alert.alert('Verification Failed', res.message);
    }
  };

  const handleSellerPassphraseLogin = async () => {
    if (!sellerPhone.trim() || !sellerPassphrase.trim()) {
      Alert.alert('Credentials Required', 'Enter your phone number and passphrase.');
      return;
    }
    const res = await loginSellerWithPassphrase(sellerPhone.trim(), sellerPassphrase.trim());
    if (!res.success) {
      Alert.alert('Login Failed', res.message);
    }
  };

  return (
    <View style={[styles.screenContainer, isDarkMode && styles.screenContainerDark]}>
      {isDarkMode && (
        <View
          pointerEvents="none"
          style={[
            styles.darkGlassBackdrop,
            Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px)' } as object) : null,
          ]}
        />
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Centered Brand & Store Heading */}
          <View style={styles.brandHeaderCentered}>
            {!logoError ? (
              <View style={[styles.brandLogoWrapper, isDarkMode && styles.brandLogoWrapperDark]}>
                {isDarkMode && (
                  <View pointerEvents="none" style={styles.logoGlowContainer}>
                    <View
                      style={[
                        styles.logoGlowMid,
                        Platform.OS === 'web' ? ({ filter: 'blur(22px)' } as object) : null,
                      ]}
                    />
                  </View>
                )}
                <View style={isDarkMode ? styles.logoClipDark : styles.logoClipLight}>
                  <Image 
                    source={require('../../assets/login-turquoise-logo.png')} 
                    style={styles.loginLogoImage} 
                    resizeMode="contain" 
                    onError={() => setLogoError(true)}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.storePill, isDarkMode && styles.storePillDark]}>
                <MaterialCommunityIcons name="diamond-stone" size={15} color="#FBBF24" />
                <Text style={[styles.storePillText, isDarkMode && { color: '#F8FAFC' }]}>The Gem</Text>
              </View>
            )}
            <Text style={[styles.mainBrandHeading, isDarkMode && { color: '#F8FAFC' }]}>
              Access your store
            </Text>
          </View>

          {/* Login Card */}
          <View style={[styles.card, isDarkMode && styles.cardDark]}>
            {/* Alternative Tabs: Admin Login vs Sales Person Login */}
            <View
              style={[
                styles.tabSelector,
                isDarkMode && { borderColor: '#8E918F' },
              ]}
              onLayout={(e) => setTabSelectorWidth(e.nativeEvent.layout.width)}
            >
              {pillWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.tabActivePill,
                    {
                      width: pillWidth,
                      backgroundColor: pillColor,
                      transform: [{ translateX: pillTranslateX }],
                    },
                  ]}
                />
              )}
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => switchTab('MERCHANT')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={activeTab === 'MERCHANT' ? '#FFFFFF' : (isDarkMode ? '#CFE9EC' : '#64748B')}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    isDarkMode && { color: '#CFE9EC' },
                    activeTab === 'MERCHANT' && styles.tabButtonTextActive
                  ]}
                >
                  Master Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => switchTab('SELLER')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="cellphone-key"
                  size={15}
                  color={activeTab === 'SELLER' ? '#FFFFFF' : (isDarkMode ? '#CFE9EC' : '#64748B')}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    isDarkMode && { color: '#CFE9EC' },
                    activeTab === 'SELLER' && styles.tabButtonTextActive
                  ]}
                >
                  Sales Login
                </Text>
              </TouchableOpacity>
            </View>

            <Animated.View
              style={{
                opacity: formOpacity,
                transform: [{ translateX: formTranslateX }],
              }}
            >
              {/* TAB 1: MASTER CLERK SIGN-IN */}
              {activeTab === 'MERCHANT' &&
                (clerkConfigured ? (
                  <ClerkMerchantSignInForm isDarkMode={isDarkMode} />
                ) : (
                  <View style={styles.tabContent}>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
                      CLERK NOT CONFIGURED
                    </Text>
                    <Text style={{ color: isDarkMode ? '#94A3B8' : '#475569', fontSize: 13, lineHeight: 20 }}>
                      Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and EXPO_PUBLIC_API_URL in frontend/.env to sign in as Master with Clerk.
                    </Text>
                  </View>
                ))}

              {/* TAB 2: SALES PERSON PHONE & SMS OTP / PASSPHRASE LOGIN */}
              {activeTab === 'SELLER' && (
                <View style={styles.tabContent}>
                {/* 1. Enter Phone Number Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
                    ENTER PHONE NUMBER
                  </Text>
                  <View style={styles.phoneInputRow}>
                    <View style={[styles.flagBadge, isDarkMode && styles.flagBadgeDark]}>
                      <Text style={[styles.flagText, isDarkMode && { color: '#F8FAFC' }]}>🇰🇪 +254</Text>
                    </View>
                    <TextInput
                      style={[styles.phoneInput, isDarkMode && styles.phoneInputDark]}
                      placeholder="0712345678"
                      placeholderTextColor={THEME.colors.textMuted}
                      keyboardType="phone-pad"
                      value={sellerPhone}
                      onChangeText={setSellerPhone}
                      editable={!otpSent}
                    />
                  </View>
                </View>

                {usePassphraseMode ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
                        PASSPHRASE
                      </Text>
                      <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
                        <Ionicons name="lock-closed" size={18} color="#0891B2" style={styles.inputIcon} />
                        <TextInput
                          style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
                          placeholder="Enter your passphrase"
                          placeholderTextColor={THEME.colors.textMuted}
                          secureTextEntry
                          value={sellerPassphrase}
                          onChangeText={setSellerPassphrase}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.sellerSubmitBtn}
                      onPress={handleSellerPassphraseLogin}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="log-in" size={19} color="#FFFFFF" />
                      <Text style={styles.sellerSubmitBtnText}>LOGIN WITH PASSPHRASE</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <View style={styles.otpLabelRow}>
                        <Text style={[styles.inputLabel, isDarkMode && { color: '#E2E8F0' }]}>
                          {otpSent ? 'ENTER 6-DIGIT SMS VERIFICATION CODE' : 'SMS VERIFICATION CODE'}
                        </Text>
                      </View>
                      <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark, !otpSent && styles.inputContainerDimmed]}>
                        <Ionicons
                          name="keypad-outline"
                          size={18}
                          color={otpSent ? '#D97706' : (isDarkMode ? '#64748B' : '#94A3B8')}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={[styles.inputField, isDarkMode && { color: '#F8FAFC' }]}
                          placeholder={otpSent ? 'Enter 6-digit code' : 'Click Generate OTP below'}
                          placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
                          keyboardType="number-pad"
                          maxLength={6}
                          value={otpCode}
                          onChangeText={setOtpCode}
                        />
                      </View>
                    </View>

                    {!otpSent ? (
                      <TouchableOpacity
                        style={styles.sellerSubmitBtn}
                        onPress={handleRequestSellerOtp}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                        <Text style={styles.sellerSubmitBtnText}>GENERATE SMS OTP</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.sellerSubmitBtn}
                        onPress={handleVerifySellerOtp}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
                        <Text style={styles.sellerSubmitBtnText}>VERIFY OTP & LOGIN</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={styles.demoHelperRow}
                  onPress={() => {
                    setUsePassphraseMode((prev) => !prev);
                    setOtpSent(false);
                  }}
                >
                  <Ionicons name="key-outline" size={13} color="#0891B2" />
                  <Text style={styles.demoHelperText}>
                    {usePassphraseMode ? 'Use SMS OTP instead' : 'Sign in with Passphrase instead'}
                  </Text>
                </TouchableOpacity>

                {otpSent && !usePassphraseMode && (
                  <View style={styles.resendRow}>
                    <TouchableOpacity
                      onPress={handleRequestSellerOtp}
                      disabled={countdown > 0}
                      style={{ opacity: countdown > 0 ? 0.5 : 1 }}
                    >
                      <Text style={[styles.resendText, isDarkMode && { color: '#22D3EE' }]}>
                        {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#94A3B8' }}>•</Text>
                    <TouchableOpacity onPress={() => { setOtpSent(false); setOtpCode(''); }}>
                      <Text style={[styles.changePhoneText, isDarkMode && { color: '#94A3B8' }]}>
                        Change Number
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                </View>
              )}
            </Animated.View>
          </View>

          {/* Current Year Footer */}
          <View style={styles.securityFooter}>
            <Text style={[styles.securityFooterText, isDarkMode && { color: '#B4D6D9' }]}>
              © {new Date().getFullYear()}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F0FDFA', // Soft daylight mint/cyan background
  },
  screenContainerDark: {
    backgroundColor: '#1D575D', // Deep NKACE logo teal
  },
  darkGlassBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(13, 44, 48, 0.28)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingBottom: 36,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandHeaderCentered: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogoWrapper: {
    position: 'relative',
    width: 150,
    height: 150,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandLogoWrapperDark: {
    width: 175,
    height: 175,
    backgroundColor: 'transparent',
  },
  logoClipLight: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoClipDark: {
    width: 175,
    height: 175,
    borderRadius: 87.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logoGlowContainer: {
    position: 'absolute',
    width: 175,
    height: 175,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGlowMid: {
    position: 'absolute',
    width: 175,
    height: 175,
    borderRadius: 87.5,
    backgroundColor: 'rgba(240, 253, 250, 0.75)',
    shadowColor: '#F0FDFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
  },
  loginLogoImage: {
    width: 150,
    height: 150,
    zIndex: 1,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  storePillDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  storePillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  mainBrandHeading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'stretch',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    borderWidth: 0,
    padding: 8,
  },
  cardDark: {
    backgroundColor: 'transparent',
  },
  tabSelector: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    borderRadius: 24,
    padding: 4,
    gap: 4,
    marginBottom: 16,
    width: '100%',
  },
  tabActivePill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 20,
  },
  tabButton: {
    flex: 1,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabContent: {
    width: '100%',
    minHeight: 285,
  },
  infoBannerMerchant: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  infoBannerTextMerchant: {
    fontSize: 11,
    color: '#0E7490',
    lineHeight: 15,
    flex: 1,
  },
  infoBannerSeller: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  infoBannerTextSeller: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  inputContainerDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    height: 48,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  merchantLoginBtn: {
    backgroundColor: THEME.colors.primary,
    height: 50,
    borderRadius: 24,
    borderWidth: 0.75,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  merchantLoginBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  googleOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  googleOAuthBtnDark: {
    backgroundColor: '#F0FDFA',
    borderColor: '#7AB5BC',
  },
  googleOAuthBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    letterSpacing: 0.15,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orDividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  demoHelperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    paddingVertical: 6,
  },
  demoHelperText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  assignedGuideBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  assignedGuideBoxDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  assignedGuideTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  assignedSellerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 3,
  },
  assignedSellerChipActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  assignedSellerChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flagBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 51,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
  },
  flagBadgeDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
  },
  flagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  phoneInput: {
    flex: 1,
    height: 51,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.75,
    borderColor: '#DADCE0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneInputDark: {
    backgroundColor: '#256A71',
    borderColor: '#7AB5BC',
    color: '#F0FDFA',
  },
  otpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inlineAutoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inlineAutoFillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  inputContainerDimmed: {
    opacity: 0.85,
    backgroundColor: '#F8FAFC',
  },
  sellerSubmitBtn: {
    backgroundColor: '#D97706',
    height: 50,
    borderRadius: 24,
    borderWidth: 0.75,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  sellerSubmitBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sellerMiniChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 4,
  },
  sellerMiniChipActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#D97706',
  },
  sellerMiniChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  sellerMiniChipTextActive: {
    fontWeight: '800',
    color: '#78350F',
  },
  requestOtpBtn: {
    backgroundColor: '#D97706',
    height: 50,
    borderRadius: 24,
    borderWidth: 0.75,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  requestOtpBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  otpWorkflowContainer: {
    marginTop: 6,
  },
  smsCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  smsCardDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  smsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  smsCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  smsCardBody: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 15,
  },
  smsCodeBold: {
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
  otpCodeInput: {
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
  otpCodeInputDark: {
    backgroundColor: '#0F172A',
    borderColor: '#F59E0B',
    color: '#FCD34D',
  },
  verifySellerBtn: {
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  verifySellerBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
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
  securityFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 480,
  },
  securityFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  }
});

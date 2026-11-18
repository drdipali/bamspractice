import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BookOpen,
  Lock,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ArrowRight,
  GraduationCap,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const WelcomeScreen: React.FC = () => {
  const { logIn, signUp } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'mobile'>('mobile');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    setErrorMessage('');

    if (isSignUp) {
      if (!email.trim() || !password) {
        setErrorMessage('Please enter email and password.');
        return;
      }
      if (phone.trim() && phone.replace(/[^0-9]/g, '').length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }
    } else {
      // Log In validation
      if (loginMethod === 'mobile') {
        const cleanDigits = phone.replace(/[^0-9]/g, '');
        if (!cleanDigits || cleanDigits.length < 10) {
          setErrorMessage('Please enter your 10-digit registered mobile number.');
          return;
        }
      } else {
        if (!email.trim()) {
          setErrorMessage('Please enter your registered email address.');
          return;
        }
      }
      if (!password) {
        setErrorMessage('Please enter your password.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, phone.trim() ? phone.replace(/[^0-9]/g, '') : undefined);
      } else {
        const identifier = loginMethod === 'mobile' ? phone.replace(/[^0-9]/g, '') : email.trim();
        await logIn(identifier, password);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickCredentials = (demoEmail: string, demoPhone: string, demoPass: string) => {
    setEmail(demoEmail);
    setPhone(demoPhone);
    setPassword(demoPass);
    setErrorMessage('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <BookOpen size={32} color={THEME.colors.brandInk} />
          </View>
          <Text style={styles.brandTitle}>BAMS Practice Builder</Text>
          <Text style={styles.brandSubtitle}>
            Ayurvedic PG Entrance (AIAPGET) &amp; Samhita Chapter Mastery
          </Text>
        </View>

        {/* Main Auth Card */}
        <View style={styles.card}>
          {/* Mode Switcher: Log In vs Sign Up */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, !isSignUp && styles.tabBtnActive]}
              onPress={() => {
                setIsSignUp(false);
                setErrorMessage('');
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabBtnText, !isSignUp && styles.tabBtnTextActive]}
              >
                Log In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, isSignUp && styles.tabBtnActive]}
              onPress={() => {
                setIsSignUp(true);
                setErrorMessage('');
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabBtnText, isSignUp && styles.tabBtnTextActive]}
              >
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sub-toggle for Login: Mobile vs Email */}
          {!isSignUp && (
            <View style={styles.methodSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.methodPill,
                  loginMethod === 'mobile' && styles.methodPillActive,
                ]}
                onPress={() => {
                  setLoginMethod('mobile');
                  setErrorMessage('');
                }}
              >
                <Phone
                  size={13}
                  color={
                    loginMethod === 'mobile' ? THEME.colors.brandInk : THEME.colors.muted
                  }
                />
                <Text
                  style={[
                    styles.methodPillText,
                    loginMethod === 'mobile' && styles.methodPillTextActive,
                  ]}
                >
                  Mobile Number
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodPill,
                  loginMethod === 'email' && styles.methodPillActive,
                ]}
                onPress={() => {
                  setLoginMethod('email');
                  setErrorMessage('');
                }}
              >
                <Mail
                  size={13}
                  color={
                    loginMethod === 'email' ? THEME.colors.brandInk : THEME.colors.muted
                  }
                />
                <Text
                  style={[
                    styles.methodPillText,
                    loginMethod === 'email' && styles.methodPillTextActive,
                  ]}
                >
                  Email Address
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color={THEME.colors.bad} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Login via Mobile OR Sign Up Mobile Field */}
            {(!isSignUp && loginMethod === 'mobile') || isSignUp ? (
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>Student Mobile Number</Text>
                  {isSignUp && <Text style={styles.optionalTag}>(Required for SMS/Verification)</Text>}
                </View>
                <View style={styles.inputWrapper}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <Phone size={16} color={THEME.colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val.replace(/[^0-9]/g, ''));
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={THEME.colors.muted}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            ) : null}

            {/* Email Field (for Email login or Sign Up) */}
            {(!isSignUp && loginMethod === 'email') || isSignUp ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color={THEME.colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="e.g. vaidya@ayurveda.edu"
                    placeholderTextColor={THEME.colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            ) : null}

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={THEME.colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={THEME.colors.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={THEME.colors.muted} />
                  ) : (
                    <Eye size={18} color={THEME.colors.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Action Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={THEME.colors.brandInk} />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    {isSignUp
                      ? 'Create Student Account'
                      : loginMethod === 'mobile'
                      ? 'Log In with Mobile'
                      : 'Log In with Email'}
                  </Text>
                  <ArrowRight size={16} color={THEME.colors.brandInk} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Demo Credentials Helper */}
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Sparkles size={14} color={THEME.colors.accent} />
              <Text style={styles.demoTitle}>Quick 1-Tap Demo Logins:</Text>
            </View>

            <View style={styles.demoBtnRow}>
              <TouchableOpacity
                style={styles.demoChip}
                onPress={() =>
                  fillQuickCredentials('admin@bams.com', '9876543210', 'admin123')
                }
                activeOpacity={0.7}
              >
                <Shield size={13} color={THEME.colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoChipText}>Admin Portal</Text>
                  <Text style={styles.demoSubText}>+91 98765 43210 · admin@bams.com</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoChip}
                onPress={() =>
                  fillQuickCredentials('sharma.ayur@bams.com', '9820012345', 'student123')
                }
                activeOpacity={0.7}
              >
                <GraduationCap size={13} color={THEME.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoChipText}>Student (Vaidya Sharma)</Text>
                  <Text style={styles.demoSubText}>+91 98200 12345 · sharma.ayur@bams.com</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerNote}>
          1,179 Chapters · 25 Classical Texts · Real PG Entrance Exam MCQs
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.ink,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
    lineHeight: 18,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  tabBtnActive: {
    backgroundColor: THEME.colors.brand,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  tabBtnTextActive: {
    color: THEME.colors.brandInk,
  },
  methodSelectorRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    gap: 4,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  methodPillActive: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  methodPillText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  methodPillTextActive: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.badSoft,
    padding: 10,
    borderRadius: THEME.radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(197, 48, 48, 0.2)',
  },
  errorText: {
    fontSize: 12,
    color: THEME.colors.bad,
    flex: 1,
    lineHeight: 16,
  },
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  optionalTag: {
    fontSize: 10,
    color: THEME.colors.muted,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  countryCodeBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.ink,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 13,
    borderRadius: THEME.radius.md,
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    gap: 10,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoBtnRow: {
    gap: 8,
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.bg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  demoChipText: {
    fontSize: 12,
    color: THEME.colors.ink,
    fontWeight: '600',
  },
  demoSubText: {
    fontSize: 10,
    color: THEME.colors.muted,
    marginTop: 1,
  },
  footerNote: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 20,
    textAlign: 'center',
  },
});

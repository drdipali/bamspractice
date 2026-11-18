import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogOut, Shield, User } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { Language } from '../../types';
import { SegmentedControl } from './SegmentedControl';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Build a practice test',
  subtitle = 'Tick chapters from any Samhita or subject.',
  rightAction,
}) => {
  const { language, setLanguage, currentUser, logOut, navigateToAdmin, view } = useApp();

  const langOptions: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'both', label: 'Both' },
  ];

  const isAdmin = currentUser?.email.toLowerCase() === 'admin@bams.com';

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.rightCluster}>
          {/* User Bar */}
          {currentUser && (
            <View style={styles.userBadgeRow}>
              {isAdmin && view !== 'admin' && (
                <TouchableOpacity
                  style={styles.adminBadgeBtn}
                  onPress={navigateToAdmin}
                  activeOpacity={0.7}
                  accessibilityLabel="Open Admin Dashboard"
                >
                  <Shield size={12} color={THEME.colors.brandInk} />
                  <Text style={styles.adminBadgeBtnText}>Admin Panel</Text>
                </TouchableOpacity>
              )}

              <View style={styles.userPill}>
                <User size={12} color={THEME.colors.muted} />
                <Text style={styles.userPillText} numberOfLines={1}>
                  {currentUser.email}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={logOut}
                activeOpacity={0.7}
                accessibilityLabel="Log Out"
              >
                <LogOut size={13} color={THEME.colors.bad} />
              </TouchableOpacity>
            </View>
          )}

          {rightAction ? (
            <View style={styles.rightActionArea}>{rightAction}</View>
          ) : (
            <View style={styles.langArea}>
              <SegmentedControl
                options={langOptions}
                value={language}
                onChange={setLanguage}
                style={styles.langSegment}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  titleArea: {
    flex: 1,
    minWidth: 180,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  userBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.bg,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  adminBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  adminBadgeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 160,
  },
  userPillText: {
    fontSize: 11,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  logoutBtn: {
    padding: 4,
  },
  langArea: {
    minWidth: 160,
  },
  langSegment: {
    width: '100%',
  },
  rightActionArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

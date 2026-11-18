import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Shield,
  Search,
  RefreshCw,
  Users,
  Award,
  BookOpen,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Calendar,
  X,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { UserRecord } from '../../types/auth';
import { backend } from '../../services/backend';
import { useApp } from '../../context/AppContext';

export const AdminDashboard: React.FC = () => {
  const { setView, currentUser } = useApp();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await backend.getAllUsers();
      setUsers(all);
    } catch (e) {
      console.warn('Failed to load admin users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q));
  }, [users, query]);

  // High-level analytics metrics
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    let totalQuizzes = 0;
    let totalScoreSum = 0;
    let totalMaxScoreSum = 0;

    users.forEach((u) => {
      totalQuizzes += u.quizCount || 0;
      u.quizzes.forEach((q) => {
        totalScoreSum += q.score;
        totalMaxScoreSum += q.maxScore;
      });
    });

    const avgScorePercent =
      totalMaxScoreSum > 0
        ? Math.round((totalScoreSum / totalMaxScoreSum) * 100)
        : 0;

    return {
      totalUsers,
      totalQuizzes,
      avgScorePercent,
    };
  }, [users]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString.slice(0, 10);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* Admin Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shieldBadge}>
            <Shield size={20} color={THEME.colors.brandInk} />
          </View>
          <View>
            <Text style={styles.headerTitle}>BAMS Cloud Admin Console</Text>
            <Text style={styles.headerSubtitle}>
              Logged in as <Text style={{ fontWeight: '700' }}>{currentUser?.email}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadData}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color={THEME.colors.brand} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setView('build')}
            activeOpacity={0.7}
          >
            <ArrowLeft size={14} color={THEME.colors.brandInk} />
            <Text style={styles.backBtnText}>Back to App</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Metric Summary Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Users size={18} color={THEME.colors.brand} />
            </View>
            <Text style={styles.metricNumber}>{metrics.totalUsers}</Text>
            <Text style={styles.metricLabel}>Registered Users</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <BookOpen size={18} color={THEME.colors.accent} />
            </View>
            <Text style={styles.metricNumber}>{metrics.totalQuizzes}</Text>
            <Text style={styles.metricLabel}>Total Quizzes Taken</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIconBox}>
              <Award size={18} color={THEME.colors.ok} />
            </View>
            <Text style={styles.metricNumber}>{metrics.avgScorePercent}%</Text>
            <Text style={styles.metricLabel}>Avg. Student Accuracy</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color={THEME.colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search registered users by email..."
              placeholderTextColor={THEME.colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <X size={16} color={THEME.colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Users Table / List */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableTitle}>
              All Registered Users ({filteredUsers.length})
            </Text>
            <Text style={styles.tableSubtitle}>
              Cloud database live user synchronization
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={THEME.colors.brand} />
              <Text style={styles.loadingText}>Fetching cloud user database...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No users found matching "{query}".
              </Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.id;
                const isAdmin = user.email.toLowerCase() === 'admin@bams.com';

                return (
                  <View key={user.id} style={styles.userItem}>
                    <TouchableOpacity
                      style={styles.userRow}
                      onPress={() =>
                        setExpandedUserId(isExpanded ? null : user.id)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={styles.userMainCol}>
                        <View style={styles.userEmailRow}>
                          <Text style={styles.userEmail}>{user.email}</Text>
                          {isAdmin && (
                            <View style={styles.adminTag}>
                              <Text style={styles.adminTagText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.userMetaRow}>
                          <View style={styles.metaBadge}>
                            <Calendar size={11} color={THEME.colors.muted} />
                            <Text style={styles.metaText}>
                              Joined: {formatDate(user.createdAt)}
                            </Text>
                          </View>
                          <View style={styles.metaBadge}>
                            <Clock size={11} color={THEME.colors.muted} />
                            <Text style={styles.metaText}>
                              Active: {formatDate(user.lastActive)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.userRightCol}>
                        <View style={styles.quizCountBadge}>
                          <Text style={styles.quizCountNumber}>
                            {user.quizCount || 0}
                          </Text>
                          <Text style={styles.quizCountLabel}>
                            {user.quizCount === 1 ? 'Quiz' : 'Quizzes'}
                          </Text>
                        </View>

                        {isExpanded ? (
                          <ChevronDown size={18} color={THEME.colors.muted} />
                        ) : (
                          <ChevronRight size={18} color={THEME.colors.muted} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Expandable Quiz Attempts History */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        <Text style={styles.historyHeading}>
                          Recent Quiz Scores &amp; Activity:
                        </Text>
                        {user.quizzes.length === 0 ? (
                          <Text style={styles.noQuizzesText}>
                            No quizzes completed yet.
                          </Text>
                        ) : (
                          <View style={styles.historyList}>
                            {user.quizzes.map((q) => (
                              <View key={q.id} style={styles.historyRow}>
                                <View style={styles.historyLeft}>
                                  <CheckCircle2
                                    size={14}
                                    color={THEME.colors.ok}
                                  />
                                  <Text style={styles.historyDate}>
                                    {formatDate(q.timestamp)} {formatTime(q.timestamp)}
                                  </Text>
                                  <View style={styles.modeTag}>
                                    <Text style={styles.modeTagText}>
                                      {q.mode.toUpperCase()}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.historyScoreBox}>
                                  <Text style={styles.historyScoreText}>
                                    Score: {q.score} / {q.maxScore} ({q.scorePercent}%)
                                  </Text>
                                  <Text style={styles.historyDetailText}>
                                    +{q.correct} / -{q.incorrect} / {q.unattempted} blank
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  header: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shieldBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: THEME.colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.brand,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: THEME.colors.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricNumber: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.ink,
  },
  tableCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    backgroundColor: THEME.colors.soft,
  },
  tableTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  tableSubtitle: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.muted,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.muted,
  },
  userList: {
    width: '100%',
  },
  userItem: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  userMainCol: {
    flex: 1,
    gap: 4,
  },
  userEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  adminTag: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.brandInk,
    letterSpacing: 0.5,
  },
  userMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  userRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quizCountBadge: {
    alignItems: 'center',
    backgroundColor: THEME.colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  quizCountNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  quizCountLabel: {
    fontSize: 9,
    color: THEME.colors.muted,
    textTransform: 'uppercase',
  },
  expandedSection: {
    backgroundColor: THEME.colors.bg,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    gap: 8,
  },
  historyHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  noQuizzesText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontStyle: 'italic',
  },
  historyList: {
    gap: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDate: {
    fontSize: 11,
    color: THEME.colors.ink,
  },
  modeTag: {
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  modeTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  historyScoreBox: {
    alignItems: 'flex-end',
  },
  historyScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  historyDetailText: {
    fontSize: 10,
    color: THEME.colors.muted,
  },
});

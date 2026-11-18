import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { ChapterStat } from '../../types';

interface ChapterAccuracyListProps {
  statsByChapter: Record<string | number, ChapterStat>;
}

export const ChapterAccuracyList: React.FC<ChapterAccuracyListProps> = ({
  statsByChapter,
}) => {
  const statsList = Object.values(statsByChapter);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Accuracy by chapter</Text>

      <View style={styles.list}>
        {statsList.map((stat) => {
          const displayName = stat.chapterName || String(stat.chapterId);

          return (
            <View key={stat.chapterId} style={styles.row}>
              <View style={styles.chapterInfo}>
                <Text style={styles.chapterPath} numberOfLines={1}>
                  {displayName}
                </Text>
              </View>

              <View style={styles.barContainer}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${stat.accuracy}%` },
                      stat.accuracy < 50 && styles.barFillLow,
                    ]}
                  />
                </View>
              </View>

              <View style={styles.ratioBox}>
                <Text style={styles.ratioText}>
                  {stat.correct}/{stat.total}
                </Text>
                <Text style={styles.percentText}>{stat.accuracy}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
    marginVertical: 12,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  chapterInfo: {
    flex: 1.5,
  },
  chapterPath: {
    fontSize: 13,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
  },
  barTrack: {
    height: 8,
    backgroundColor: THEME.colors.soft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: THEME.colors.ok,
  },
  barFillLow: {
    backgroundColor: THEME.colors.bad,
  },
  ratioBox: {
    width: 65,
    alignItems: 'flex-end',
  },
  ratioText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  percentText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { THEME } from '../../constants/theme';

interface QuizTimerProps {
  startTime: number;
}

export const QuizTimer: React.FC<QuizTimerProps> = ({ startTime }) => {
  const [elapsedSecs, setElapsedSecs] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setElapsedSecs(Math.max(0, Math.floor((now - startTime) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Clock size={14} color={THEME.colors.muted} />
      <Text style={styles.timerText}>{formatted}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    fontVariant: ['tabular-nums'],
  },
});

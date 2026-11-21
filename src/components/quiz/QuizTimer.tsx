import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, AlertCircle } from 'lucide-react-native';
import { THEME } from '../../constants/theme';

interface QuizTimerProps {
  startTime: number;
  durationSecs?: number; // When present, counts down from durationSecs
  onTimeUp?: () => void;
}

export const QuizTimer: React.FC<QuizTimerProps> = ({
  startTime,
  durationSecs,
  onTimeUp,
}) => {
  const [currentSecs, setCurrentSecs] = useState<number>(0);

  useEffect(() => {
    let triggered = false;
    const update = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));

      if (durationSecs && durationSecs > 0) {
        const remaining = Math.max(0, durationSecs - elapsed);
        setCurrentSecs(remaining);
        if (remaining <= 0 && !triggered) {
          triggered = true;
          onTimeUp?.();
        }
      } else {
        setCurrentSecs(elapsed);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, durationSecs, onTimeUp]);

  const isCountdown = Boolean(durationSecs && durationSecs > 0);
  const isUrgent = isCountdown && currentSecs < 600; // Under 10 minutes

  const hours = Math.floor(currentSecs / 3600);
  const mins = Math.floor((currentSecs % 3600) / 60);
  const secs = currentSecs % 60;

  const formatted =
    hours > 0
      ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      {isUrgent ? (
        <AlertCircle size={14} color="#DC2626" />
      ) : (
        <Clock size={14} color={isCountdown ? '#1D4ED8' : THEME.colors.muted} />
      )}
      <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
        {isCountdown ? `${formatted} left` : formatted}
      </Text>
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
  containerUrgent: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: {
    color: '#DC2626',
    fontWeight: '700',
  },
});

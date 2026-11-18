import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { BuilderScreen } from './src/components/builder/BuilderScreen';
import { QuizScreen } from './src/components/quiz/QuizScreen';
import { ResultsScreen } from './src/components/results/ResultsScreen';
import { THEME } from './src/constants/theme';

const MainNavigator: React.FC = () => {
  const { view } = useApp();

  return (
    <View style={styles.appContainer}>
      {view === 'build' && <BuilderScreen />}
      {view === 'quiz' && <QuizScreen />}
      {view === 'result' && <ResultsScreen />}
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar style="dark" backgroundColor={THEME.colors.surface} />
          <MainNavigator />
        </SafeAreaView>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
  },
  appContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
});

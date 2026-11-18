import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { WelcomeScreen } from './src/components/auth/WelcomeScreen';
import { BuilderScreen } from './src/components/builder/BuilderScreen';
import { QuizScreen } from './src/components/quiz/QuizScreen';
import { ResultsScreen } from './src/components/results/ResultsScreen';
import { AdminDashboard } from './src/components/admin/AdminDashboard';
import { THEME } from './src/constants/theme';

const MainNavigator: React.FC = () => {
  const { view, currentUser } = useApp();

  if (!currentUser || view === 'auth') {
    return <WelcomeScreen />;
  }

  return (
    <View style={styles.appContainer}>
      {view === 'build' && <BuilderScreen />}
      {view === 'quiz' && <QuizScreen />}
      {view === 'result' && <ResultsScreen />}
      {view === 'admin' && <AdminDashboard />}
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

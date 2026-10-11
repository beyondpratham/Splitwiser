import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { PaperProvider } from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';
import { FeedbackProvider } from '@/components/Feedback';
import { Loading } from '@/components/ui';
import { useRealtimeSync } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import { darkTheme, lightTheme } from '@/theme';

registerTranslation('en', en);

function RootStack() {
  const { session, ready, configured } = useAuth();
  const qc = useQueryClient();
  const userId = session?.user.id;
  useRealtimeSync();

  // Never show one account's cached data to another.
  useEffect(() => {
    qc.clear();
  }, [userId, qc]);

  if (!ready) return <Loading />;

  const dialog = { animation: 'slide_from_bottom' as const, presentation: 'modal' as const };
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'default' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Protected guard={!configured}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={configured && !session}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={configured && !!session}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="group/[id]/index" />
        <Stack.Screen name="group/[id]/balances" />
        <Stack.Screen name="group/[id]/settings" />
        <Stack.Screen name="friend/[id]" />
        <Stack.Screen name="expense/[id]" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="backend" options={dialog} />
        <Stack.Screen name="add-expense" options={dialog} />
        <Stack.Screen name="settle-up" options={dialog} />
        <Stack.Screen name="new-group" options={dialog} />
        <Stack.Screen name="add-friend" options={dialog} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.surface).catch(() => {});
  }, [theme]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <KeyboardProvider>
        <PaperProvider theme={theme} settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}>
          <QueryClientProvider client={client}>
            <AuthProvider>
              <FeedbackProvider describeError={friendlyError}>
                <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                <RootStack />
              </FeedbackProvider>
            </AuthProvider>
          </QueryClientProvider>
        </PaperProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

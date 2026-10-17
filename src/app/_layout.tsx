import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { FeedbackProvider } from '@/components/Feedback';
import { Loading } from '@/components/ui';
import { useRealtimeSync } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { session, ready, configured } = useAuth();
  const t = useTheme();
  const qc = useQueryClient();
  const userId = session?.user.id;
  useRealtimeSync();

  // Never show one account's cached data to another.
  useEffect(() => {
    qc.clear();
  }, [userId, qc]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  if (!ready) return <Loading />;

  const dialog = { animation: 'slide_from_bottom' as const, presentation: 'modal' as const };
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'default', contentStyle: { backgroundColor: t.bg } }}>
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
          <Stack.Screen name="profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="help" />
          <Stack.Screen name="coffee" options={dialog} />
          <Stack.Screen name="backend" options={dialog} />
          <Stack.Screen name="add-expense" options={dialog} />
          <Stack.Screen name="settle-up" options={dialog} />
          <Stack.Screen name="new-group" options={dialog} />
          <Stack.Screen name="add-friend" options={dialog} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <QueryClientProvider client={client}>
            <AuthProvider>
              <FeedbackProvider describeError={friendlyError}>
                <RootStack />
              </FeedbackProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

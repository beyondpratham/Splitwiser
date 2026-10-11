import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { Loading } from '@/components/ui';
import { useRealtimeSync } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import { useTheme } from '@/theme';

function RootStack() {
  const { session, ready } = useAuth();
  const t = useTheme();
  useRealtimeSync();

  if (!ready) return <Loading />;

  const modal = { presentation: 'modal' as const, headerShown: true };
  return (
    <Stack
      screenOptions={{
        headerTintColor: t.accent,
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: t.background },
        contentStyle: { backgroundColor: t.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={!isConfigured}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isConfigured && !session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={isConfigured && !!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="group/[id]/balances" options={{ title: 'Balances' }} />
        <Stack.Screen name="group/[id]/settings" options={{ title: 'Group settings' }} />
        <Stack.Screen name="friend/[id]" options={{ title: '' }} />
        <Stack.Screen name="expense/[id]" options={{ title: '' }} />
        <Stack.Screen name="insights" options={{ title: 'Insights' }} />
        <Stack.Screen name="add-expense" options={{ ...modal, title: 'Add expense' }} />
        <Stack.Screen name="settle-up" options={{ ...modal, title: 'Settle up' }} />
        <Stack.Screen name="new-group" options={{ ...modal, title: 'New group' }} />
        <Stack.Screen
          name="add-friend"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 1], sheetGrabberVisible: true, title: 'Add friend', headerShown: true }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  );
  const scheme = useColorScheme();
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootStack />
      </AuthProvider>
    </QueryClientProvider>
  );
}

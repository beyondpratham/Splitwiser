import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function GroupsLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerTransparent: true,
        headerBlurEffect: 'systemChromeMaterial',
        headerLargeStyle: { backgroundColor: t.background },
        headerShadowVisible: false,
        headerTintColor: t.accent,
        headerTitleStyle: { color: t.text },
        contentStyle: { backgroundColor: t.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Groups' }} />
    </Stack>
  );
}

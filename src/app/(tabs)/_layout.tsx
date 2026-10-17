import { Tabs } from 'expo-router';
import { NavigationBar } from '@/components/NavigationBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      initialRouteName="friends"
      tabBar={(props) => <NavigationBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: t.bg } }}
    >
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

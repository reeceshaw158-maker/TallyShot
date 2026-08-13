import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../src/theme';

export default function TabLayout() {
  const t = useThemeTokens();
  // On Samsung (and any Android with edgeToEdgeEnabled), the system navigation
  // bar lives inside the app's drawing area. insets.bottom is the height of
  // that bar (24–48 dp for button nav, 0 for full-gesture nav). We add it to
  // both the tab bar height and its paddingBottom so the tab icons sit above
  // the system gesture zone on every device.
  const insets = useSafeAreaInsets();
  const TAB_BAR_CONTENT_HEIGHT = 68; // px above the system nav area
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textSubtle,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: tabBarHeight,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          letterSpacing: 0.2,
        },
        headerStyle: { backgroundColor: '#000000' },
        headerTitleStyle: { color: '#f5f5f7', fontFamily: 'Inter_700Bold' },
        sceneStyle: { backgroundColor: '#000000' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Receipts',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-pie" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

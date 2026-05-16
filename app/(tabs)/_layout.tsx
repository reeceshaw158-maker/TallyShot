import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../src/theme';
import { Text } from 'react-native-paper';

/** Raised vibrant-green Scan FAB in the centre of the tab bar. */
function CenterScanButton() {
  const t = useThemeTokens();
  return (
    <TouchableOpacity
      style={styles.fabWrap}
      onPress={() => router.push('/capture')}
      activeOpacity={0.85}
    >
      <View style={[styles.fab, { backgroundColor: t.cta, shadowColor: t.cta }]}>
        <MaterialCommunityIcons name="camera-plus" size={26} color={t.ctaText} />
      </View>
      <Text style={[styles.fabLabel, { color: t.textMuted }]}>Scan</Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const TAB_HEIGHT = 62;
  const tabBarHeight = TAB_HEIGHT + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.cta,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          // Tab bar matches the page background per the new design spec, with a
          // single hairline divider at the top to delineate it from content.
          backgroundColor: t.background,
          borderTopWidth: 1,
          borderTopColor: t.border,
          height: tabBarHeight,
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 10,
          letterSpacing: 0.2,
        },
        headerStyle: { backgroundColor: t.background },
        headerTitleStyle: { color: t.textPrimary, fontFamily: 'Inter_700Bold' },
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Receipts',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="receipt" size={size} color={color} />
          ),
        }}
      />
      {/* Centre placeholder — the FAB floats above the bar */}
      <Tabs.Screen
        name="capture-tab"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => <CenterScanButton />,
        }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push('/capture'); } }}
      />
      <Tabs.Screen
        name="drives"
        options={{
          title: 'Drives',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="car" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 72,
    marginTop: -20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    // shadowColor is overridden inline so it tracks the live theme cta.
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  fabLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.2,
  },
});

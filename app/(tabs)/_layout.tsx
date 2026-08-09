import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../src/theme';
import { Text } from 'react-native-paper';

/** Raised vibrant-green Scan FAB — tapping shows receipt vs barcode picker. */
function CenterScanButton(navProps: any) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        {...navProps}
        style={[navProps?.style, styles.fabWrap]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        hitSlop={{ top: 22, left: 0, right: 0, bottom: 0 }}
      >
        <View style={[styles.fab, { backgroundColor: t.cta, shadowColor: t.cta }]}>
          <MaterialCommunityIcons name="camera-plus" size={26} color={t.ctaText} />
        </View>
        <Text style={[styles.fabLabel, { color: t.textMuted }]}>Scan</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, {
            backgroundColor: t.surface,
            borderColor: t.border,
            paddingBottom: insets.bottom + 16,
          }]}>
            <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>What are you scanning?</Text>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
              onPress={() => { setOpen(false); router.push('/capture'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: t.cta + '22' }]}>
                <MaterialCommunityIcons name="file-document-outline" size={26} color={t.cta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetOptionTitle, { color: t.textPrimary }]}>Scan a Receipt</Text>
                <Text style={[styles.sheetOptionSub, { color: t.textMuted }]}>AI extracts merchant, total & items</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={t.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
              onPress={() => { setOpen(false); router.push('/scan/product'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: t.accent + '22' }]}>
                <MaterialCommunityIcons name="barcode-scan" size={26} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetOptionTitle, { color: t.textPrimary }]}>Scan a Product</Text>
                <Text style={[styles.sheetOptionSub, { color: t.textMuted }]}>Nutrition, allergens & AI advice</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={t.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
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
          tabBarButton: (props) => <CenterScanButton {...props} />,
        }}
        listeners={{ tabPress: (e) => { e.preventDefault(); } }}
      />
      <Tabs.Screen
        name="drives"
        options={{
          href: null,
          headerShown: false,
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
    overflow: 'visible',
    marginTop: -18,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  fabLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    gap: 12,
  },
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    marginBottom: 4,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  sheetIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  sheetOptionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
});

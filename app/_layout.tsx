import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import { useColorScheme, View } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useAppStore } from '../src/stores/appStore';
import { getDb } from '../src/db/schema';
import { darkTokens, lightTokens } from '../src/theme';

const fontConfig = {
  default: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const },
  bodyLarge: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyMedium: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  bodySmall: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  labelLarge: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  labelSmall: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  titleLarge: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  titleMedium: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  titleSmall: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  headlineLarge: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  headlineMedium: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  headlineSmall: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  displayLarge: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  displayMedium: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  displaySmall: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
};

const lightTheme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: lightTokens.accent,
    onPrimary: lightTokens.textInverse,
    secondary: lightTokens.cta,
    primaryContainer: '#e0e7ff',
    onPrimaryContainer: lightTokens.accent,
    background: lightTokens.background,
    surface: lightTokens.surface,
    surfaceVariant: lightTokens.surfaceMuted,
    onSurface: lightTokens.textPrimary,
    onSurfaceVariant: lightTokens.textMuted,
    onBackground: lightTokens.textPrimary,
    outline: lightTokens.border,
    error: lightTokens.danger,
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkTokens.accent,
    onPrimary: darkTokens.textInverse,
    secondary: darkTokens.cta,
    primaryContainer: '#1e1b4b',
    onPrimaryContainer: darkTokens.accent,
    background: darkTokens.background,
    surface: darkTokens.surface,
    surfaceVariant: darkTokens.surfaceElevated,
    onSurface: darkTokens.textPrimary,
    onSurfaceVariant: darkTokens.textMuted,
    onBackground: darkTokens.textPrimary,
    outline: darkTokens.border,
    error: darkTokens.danger,
  },
};

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const themeMode = useAppStore((s) => s.theme);
  const resetScanCountIfNewMonth = useAppStore((s) => s.resetScanCountIfNewMonth);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const colorScheme = themeMode === 'system' ? systemScheme : themeMode;
  const paperTheme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const headerBg = paperTheme.colors.background;
  const headerText = paperTheme.colors.onBackground;

  useEffect(() => {
    getDb().catch(console.error);
    resetScanCountIfNewMonth();
  }, []);

  // Show a solid background while fonts load so the user never sees a
  // raw white/black flash before the first frame renders.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: headerBg }} />;
  }

  return (
    <PaperProvider theme={paperTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerText, fontFamily: 'Inter_700Bold' },
          headerTintColor: headerText,
          contentStyle: { backgroundColor: headerBg },
        }}
      >
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="capture" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="processing" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="review/[id]" options={{ title: 'Review Receipt' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
        <Stack.Screen name="export" options={{ title: 'Export' }} />
        <Stack.Screen name="preview" options={{ title: 'Preview' }} />
        <Stack.Screen name="archived" options={{ title: 'Archived Receipts' }} />
      </Stack>
    </PaperProvider>
  );
}

/**
 * Product barcode scanner — Step 2 of the food intelligence feature.
 *
 * Phase 1 (grocery only). On a successful barcode read we navigate to
 * /scan/result/[barcode] which (Step 3) looks it up in Open Food Facts.
 *
 * Handles every camera state explicitly — never silent.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Easing, Alert, TextInput, Linking, StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeTokens } from '../../src/theme';
import { SpringButton } from '../../src/components/SpringButton';
import { hapticMedium, hapticLight } from '../../src/utils/haptics';

// Standard grocery barcodes worldwide.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;
const FRAME_HEIGHT = 180;

export default function ProductScanScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1, duration: 1600,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0, duration: 1600,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [permission?.granted, scanAnim]);

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanLocked) return;
    setScanLocked(true);
    hapticMedium();
    router.replace(`/scan/result/${encodeURIComponent(data)}`);
    // Unlock after navigation so re-entering this screen still scans.
    setTimeout(() => setScanLocked(false), 1500);
  };

  const submitManual = () => {
    const trimmed = manualBarcode.trim();
    if (!/^\d{6,14}$/.test(trimmed)) {
      Alert.alert('Invalid barcode', 'Enter the 6–14 digit number printed under the barcode.');
      return;
    }
    setManualOpen(false);
    hapticLight();
    router.replace(`/scan/result/${trimmed}`);
  };

  // ── Permission states ──────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    return (
      <View style={[styles.permWrap, {
        backgroundColor: t.background,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }]}>
        <MaterialCommunityIcons name="camera-off-outline" size={64} color={t.textMuted} />
        <Text style={[styles.permTitle, { color: t.textPrimary }]}>Camera permission needed</Text>
        <Text style={[styles.permBody, { color: t.textMuted }]}>
          TallyShot uses the camera to read product barcodes. We only access it on the scanner screen — never in the background.
        </Text>
        <SpringButton
          style={[styles.permCta, { backgroundColor: t.cta }]}
          onPress={async () => {
            if (canAsk) await requestPermission();
            else await Linking.openSettings();
          }}
        >
          <Text style={[styles.permCtaText, { color: t.ctaText }]}>
            {canAsk ? 'Allow camera' : 'Open settings'}
          </Text>
        </SpringButton>
        <TouchableOpacity onPress={() => router.back()} style={styles.permCancel} hitSlop={12}>
          <Text style={{ color: t.textMuted }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera ready ───────────────────────────────────────────────────────
  const lineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_HEIGHT - 2],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={scanLocked ? undefined : handleBarcode}
      />

      {/* Top bar */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan product</Text>
        <TouchableOpacity
          onPress={() => { setTorchOn(v => !v); hapticLight(); }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name={torchOn ? 'flashlight' : 'flashlight-off'}
            size={22} color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Scan frame */}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frame, { borderColor: t.accent + '40' }]}>
          <View style={[styles.corner, styles.cornerTL, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: t.accent }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: t.accent }]} />
          <Animated.View
            style={[
              styles.scanLine,
              { backgroundColor: t.accent, transform: [{ translateY: lineY }] },
            ]}
          />
        </View>
        <Text style={styles.frameHint}>Align the barcode inside the frame</Text>
      </View>

      {/* Manual entry */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={() => { setManualOpen(true); hapticLight(); }}
          style={[styles.manualBtn, { backgroundColor: t.surface + 'E6', borderColor: t.border }]}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="numeric" size={18} color={t.textPrimary} />
          <Text style={[styles.manualBtnText, { color: t.textPrimary }]}>Enter barcode manually</Text>
        </TouchableOpacity>
      </View>

      {/* Manual-entry sheet */}
      {manualOpen && (
        <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setManualOpen(false)}
            activeOpacity={1}
          />
          <View style={[styles.sheet, {
            backgroundColor: t.surface,
            borderColor: t.border,
            paddingBottom: insets.bottom + 16,
          }]}>
            <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Enter barcode</Text>
            <Text style={[styles.sheetSub, { color: t.textMuted }]}>
              Type the 6–14 digit number printed below the barcode.
            </Text>
            <TextInput
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder="e.g. 5012345678900"
              placeholderTextColor={t.textSubtle}
              keyboardType="number-pad"
              maxLength={14}
              autoFocus
              style={[styles.sheetInput, {
                backgroundColor: t.surfaceElevated,
                borderColor: t.border,
                color: t.textPrimary,
              }]}
            />
            <SpringButton
              style={[styles.sheetCta, { backgroundColor: t.cta }]}
              onPress={submitManual}
            >
              <Text style={[styles.sheetCtaText, { color: t.ctaText }]}>Look up</Text>
            </SpringButton>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  permWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 14,
  },
  permTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 8 },
  permBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  permCta: {
    marginTop: 16, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, minWidth: 200, alignItems: 'center',
  },
  permCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  permCancel: { padding: 12, marginTop: 4 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#fff' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  frame: {
    width: 280, height: FRAME_HEIGHT,
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#fff' },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  scanLine: { position: 'absolute', left: 8, right: 8, height: 2, borderRadius: 2, opacity: 0.9 },
  frameHint: {
    fontFamily: 'Inter_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4,
  },

  bottomBar: { paddingHorizontal: 24, paddingTop: 16 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  manualBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, padding: 20, gap: 10,
  },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  sheetSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  sheetInput: {
    marginTop: 8, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Inter_500Medium', fontSize: 16, letterSpacing: 0.5,
  },
  sheetCta: {
    marginTop: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  sheetCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Linking, StatusBar, Animated, Easing, Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeTokens } from '../../src/theme';
import { SpringButton } from '../../src/components/SpringButton';
import { hapticMedium, hapticLight } from '../../src/utils/haptics';

// All formats the camera will try to detect in a single pass
const BARCODE_TYPES = [
  'ean13', 'ean8', 'upc_a', 'upc_e',
  'code128', 'code39', 'code93', 'itf14',
  'datamatrix', 'pdf417', 'qr', 'aztec',
] as const;

// Wide & shallow — matches real barcode proportions so users angle correctly.
// Full camera still detects barcodes outside the box; the box is just a guide.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_WIDTH  = Math.min(SCREEN_WIDTH - 36, 360);
const FRAME_HEIGHT = 145;
const CORNER_SIZE  = 26;

export default function ProductScanScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [found, setFound] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const mountedRef = useRef(true);
  const lockedRef  = useRef(false);

  // ── Animations ─────────────────────────────────────────────────────────────
  const scanLineAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(0.6)).current;
  const chipFade      = useRef(new Animated.Value(0)).current;
  const foundScale    = useRef(new Animated.Value(0)).current;
  const glowOpacity   = useRef(new Animated.Value(0)).current;
  const scanningGlow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chipFade, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (scanning && !found) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      scanLineAnim.setValue(0);
    }
    return () => anim?.stop();
  }, [scanning, found]);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (scanning && !found) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      Animated.timing(pulseAnim, { toValue: found ? 0 : 0.6, duration: 200, useNativeDriver: true }).start();
    }
    return () => anim?.stop();
  }, [scanning, found]);

  useEffect(() => {
    if (found) {
      Animated.spring(foundScale, { toValue: 1, tension: 90, friction: 6, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1,   duration: 500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      foundScale.setValue(0);
      glowOpacity.setValue(0);
    }
  }, [found]);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (scanning && !found) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanningGlow, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(scanningGlow, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      scanningGlow.setValue(0);
    }
    return () => anim?.stop();
  }, [scanning, found]);

  // ── Scan logic ──────────────────────────────────────────────────────────────
  const startScan = useCallback(() => {
    if (found) return;
    lockedRef.current = false;
    setScanning(true);
    hapticLight();
  }, [found]);

  const handleBarcode = useCallback(({ data }: { data: string | null | undefined }) => {
    if (!scanning) return;
    if (lockedRef.current) return;
    if (!data || typeof data !== 'string') return;

    const trimmed = data.trim();

    // QR codes often contain URLs — show a link panel instead of product lookup
    if (/^https?:\/\//i.test(trimmed)) {
      lockedRef.current = true;
      setScanning(false);
      setQrUrl(trimmed);
      hapticMedium();
      return;
    }

    // For all other formats extract the numeric product code
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 6) return;

    lockedRef.current = true;
    setFound(true);
    setScanning(false);
    hapticMedium();

    setTimeout(() => {
      if (mountedRef.current) {
        router.replace(`/scan/result/${encodeURIComponent(digits)}`);
      }
    }, 700);
  }, [scanning]);

  const submitManual = () => {
    const trimmed = manualBarcode.trim().replace(/\D/g, '');
    if (!/^\d{6,14}$/.test(trimmed)) {
      Alert.alert('Invalid barcode', 'Enter the 6–14 digit number printed under the barcode.');
      return;
    }
    setManualOpen(false);
    hapticLight();
    router.replace(`/scan/result/${trimmed}`);
  };

  // ── Permission gates ────────────────────────────────────────────────────────
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
      <View style={[styles.permWrap, { backgroundColor: t.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <MaterialCommunityIcons name="camera-off-outline" size={64} color={t.textMuted} />
        <Text style={[styles.permTitle, { color: t.textPrimary }]}>Camera permission needed</Text>
        <Text style={[styles.permBody, { color: t.textMuted }]}>
          TallyShot uses the camera to read product barcodes. We only access it on the scanner screen.
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

  // ── Derived display values ──────────────────────────────────────────────────
  const frameColor = found
    ? '#00C896'
    : qrUrl
      ? '#FFD60A'
      : scanning
        ? t.accent
        : 'rgba(255,255,255,0.45)';

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_HEIGHT - 2],
  });

  const aiStatus      = found ? 'DETECTED' : qrUrl ? 'QR CODE' : 'SCANNING...';
  const aiStatusColor = found ? '#00C896'  : qrUrl ? '#FFD60A' : t.accent;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />

      {/* Live camera — scans the entire preview, not just the frame */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={scanning && !found ? handleBarcode : undefined}
      />

      {/* Vignette */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.vigTop} />
        <View style={{ flex: 1 }} />
        <View style={styles.vigBottom} />
      </View>

      {/* ── Top HUD bar ── */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <MaterialCommunityIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.aiChip, { opacity: chipFade }]}>
          {scanning && !found && !qrUrl ? (
            <ActivityIndicator size={10} color={aiStatusColor} style={{ marginRight: 2 }} />
          ) : (
            <View style={[styles.aiDot, { backgroundColor: aiStatusColor }]} />
          )}
          <Text style={[styles.aiChipText, { color: aiStatusColor }]}>{aiStatus}</Text>
        </Animated.View>

        <TouchableOpacity
          onPress={() => { setTorchOn(v => !v); hapticLight(); }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name={torchOn ? 'flashlight' : 'flashlight-off'}
            size={22} color={torchOn ? '#FFD60A' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* ── Scan frame ── */}
      <View style={styles.frameWrap} pointerEvents="none">

        {(scanning || found || !!qrUrl) && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                borderColor: frameColor,
                opacity: found ? glowOpacity : qrUrl ? 0.7 : scanningGlow.interpolate({
                  inputRange: [0, 1], outputRange: [0, 0.6],
                }),
              },
            ]}
          />
        )}

        <View style={[styles.frame, { height: FRAME_HEIGHT }]}>

          <Animated.View style={[styles.corner, styles.cornerTL, { borderColor: frameColor, opacity: scanning && !found ? pulseAnim : 1 }]} />
          <Animated.View style={[styles.corner, styles.cornerTR, { borderColor: frameColor, opacity: scanning && !found ? pulseAnim : 1 }]} />
          <Animated.View style={[styles.corner, styles.cornerBL, { borderColor: frameColor, opacity: scanning && !found ? pulseAnim : 1 }]} />
          <Animated.View style={[styles.corner, styles.cornerBR, { borderColor: frameColor, opacity: scanning && !found ? pulseAnim : 1 }]} />

          {scanning && !found && (
            <Animated.View
              style={[
                styles.scanLaser,
                { backgroundColor: t.accent, shadowColor: t.accent, transform: [{ translateY: scanLineY }] },
              ]}
            />
          )}

          {found && (
            <Animated.View style={[styles.foundOverlay, { transform: [{ scale: foundScale }] }]}>
              <View style={[styles.foundCircle, { backgroundColor: '#00C896' }]}>
                <MaterialCommunityIcons name="check-bold" size={34} color="#000" />
              </View>
            </Animated.View>
          )}

          <View style={StyleSheet.absoluteFill}>
            {Array.from({ length: 3 }).map((_, row) =>
              Array.from({ length: 6 }).map((_, col) => (
                <View
                  key={`${row}-${col}`}
                  style={[
                    styles.gridDot,
                    {
                      left: ((col + 1) / 7) * FRAME_WIDTH,
                      top:  ((row + 1) / 4) * FRAME_HEIGHT,
                      backgroundColor: scanning ? t.accent + '55' : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                />
              ))
            )}
          </View>
        </View>

        {/* HUD readout */}
        <View style={styles.hudRow}>
          <View style={[styles.hudPill, {
            backgroundColor: found
              ? 'rgba(0,200,150,0.15)'
              : qrUrl
                ? 'rgba(255,214,10,0.12)'
                : 'rgba(0,0,0,0.5)',
            borderColor: found
              ? '#00C89640'
              : qrUrl
                ? '#FFD60A40'
                : t.accent + '40',
          }]}>
            <Text style={[styles.hudText, {
              color: found ? '#00C896' : qrUrl ? '#FFD60A' : t.accent,
              letterSpacing: 1.2,
            }]}>
              {found ? '✓  BARCODE LOCKED' : qrUrl ? '◈  QR CODE READ' : '⬛  READING BARCODE'}
            </Text>
          </View>
        </View>

        <Text style={[styles.frameHint, { color: found ? '#00C896' : 'rgba(255,255,255,0.7)' }]}>
          {found
            ? 'Loading product information...'
            : 'Full camera detects barcodes — the box is just a guide'}
        </Text>
      </View>

      {/* ── Bottom actions ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {!found && !qrUrl && (
          <TouchableOpacity
            onPress={() => { setManualOpen(true); hapticLight(); }}
            style={[styles.manualBtn, { backgroundColor: 'rgba(0,0,0,0.55)', borderColor: 'rgba(255,255,255,0.12)' }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="numeric" size={17} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.manualBtnText, { color: 'rgba(255,255,255,0.7)' }]}>Enter barcode manually</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── QR URL overlay ── */}
      {qrUrl && !found && (
        <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setQrUrl(null); lockedRef.current = false; setScanning(true); }}
            activeOpacity={1}
          />
          <View style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={{ alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="qrcode-scan" size={36} color="#FFD60A" />
              <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>QR Code Detected</Text>
            </View>
            <Text style={[styles.sheetSub, { color: t.textMuted }]} numberOfLines={4}>{qrUrl}</Text>
            <SpringButton
              style={[styles.sheetCta, { backgroundColor: '#FFD60A' }]}
              onPress={() => Linking.openURL(qrUrl)}
            >
              <Text style={[styles.sheetCtaText, { color: '#000' }]}>Open Link</Text>
            </SpringButton>
            <TouchableOpacity
              onPress={() => { setQrUrl(null); lockedRef.current = false; setScanning(true); }}
              style={{ alignItems: 'center', paddingVertical: 12 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: t.textMuted, fontFamily: 'Inter_500Medium', fontSize: 13 }}>Scan again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Manual entry sheet ── */}
      {manualOpen && (
        <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setManualOpen(false)}
            activeOpacity={1}
          />
          <View style={[styles.sheet, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
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
              style={[styles.sheetInput, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
            />
            <SpringButton
              style={[styles.sheetCta, { backgroundColor: t.cta }]}
              onPress={submitManual}
            >
              <Text style={[styles.sheetCtaText, { color: t.ctaText }]}>Look up product</Text>
            </SpringButton>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  permTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 8, textAlign: 'center' },
  permBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  permCta: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, minWidth: 200, alignItems: 'center' },
  permCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  permCancel: { padding: 12, marginTop: 4 },

  vigTop:    { height: '20%', backgroundColor: 'rgba(0,0,0,0.55)' },
  vigBottom: { height: '26%', backgroundColor: 'rgba(0,0,0,0.55)' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },

  aiChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  aiDot: { width: 7, height: 7, borderRadius: 3.5 },
  aiChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.8 },

  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 14 },
  glowRing: {
    position: 'absolute',
    width: FRAME_WIDTH + 24,
    height: FRAME_HEIGHT + 24,
    borderRadius: 20,
    borderWidth: 2,
  },
  frame: {
    width: FRAME_WIDTH,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },

  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },

  scanLaser: {
    position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 8, elevation: 4,
  },

  foundOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,200,150,0.1)' },
  foundCircle: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00C896', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 12,
  },

  gridDot: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, marginLeft: -1.5, marginTop: -1.5 },

  hudRow: { alignItems: 'center', marginTop: 4 },
  hudPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  hudText: { fontFamily: 'Inter_700Bold', fontSize: 10 },

  frameHint: {
    fontFamily: 'Inter_500Medium', fontSize: 12,
    textAlign: 'center', paddingHorizontal: 32,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6,
  },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16, gap: 10 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1,
  },
  manualBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, padding: 20, gap: 10,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 6 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' },
  sheetSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  sheetInput: { marginTop: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Inter_500Medium', fontSize: 18, letterSpacing: 1 },
  sheetCta: { marginTop: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  sheetCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});

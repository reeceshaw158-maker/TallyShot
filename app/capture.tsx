import { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, StatusBar, Alert,
  Animated, Easing, Dimensions, ActivityIndicator, Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, FREE_SCAN_LIMIT } from '../src/stores/appStore';
import { prewarmWorker } from '../src/services/extraction';
import { hapticMedium, hapticLight } from '../src/utils/haptics';
import { useThemeTokens } from '../src/theme';
import { SpringButton } from '../src/components/SpringButton';

const { width: SW } = Dimensions.get('window');
const DOC_W  = SW * 0.80;
const DOC_H  = DOC_W * 1.34;
const CORNER_LEN   = 32;
const CORNER_THICK = 3;
const CORNER_R     = 16;
const SPREAD_PX    = 20;

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const t      = useThemeTokens();
  const isPro             = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const canScan = isPro || scansUsedThisMonth < FREE_SCAN_LIMIT;

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy]         = useState(false);
  const [docReady, setDocReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // ── Animations ──────────────────────────────────────────────────────────────
  const cornerSpread = useRef(new Animated.Value(1)).current;
  const scanLine     = useRef(new Animated.Value(0)).current;
  const cornerPulse  = useRef(new Animated.Value(0.65)).current;
  const badgeFade    = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const detectedGlow = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => { prewarmWorker(); }, [])
  );

  useFocusEffect(
    useCallback(() => {
      Animated.timing(badgeFade, {
        toValue: 1, duration: 600, delay: 200, useNativeDriver: true,
      }).start();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scanLine, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(cornerPulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
          Animated.timing(cornerPulse, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }, [])
  );

  // ── Cosmetic "AI framing" guide — purely visual, doesn't gate capture ───────
  useFocusEffect(
    useCallback(() => {
      setDocReady(false);
      cornerSpread.setValue(1);
      detectedGlow.setValue(0);
      const timer = setTimeout(() => {
        setDocReady(true);
        hapticLight();
        Animated.spring(cornerSpread, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }).start();
        Animated.loop(
          Animated.sequence([
            Animated.timing(detectedGlow, { toValue: 1,   duration: 800, useNativeDriver: true }),
            Animated.timing(detectedGlow, { toValue: 0.2, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      }, 1800);
      return () => clearTimeout(timer);
    }, [])
  );

  // ── Save helper ─────────────────────────────────────────────────────────────
  const saveImage = async (uri: string): Promise<string> => {
    const dir  = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}receipt_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  // ── Capture a photo with the in-app camera ──────────────────────────────────
  const takePhoto = useCallback(async () => {
    if (!canScan || busy || !cameraRef.current) return;
    setBusy(true);
    hapticMedium();

    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.88, duration: 70,  useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('No photo captured');

      const savedUri = await saveImage(photo.uri);
      hapticMedium();
      router.replace({
        pathname: '/processing',
        params: { imageUri: savedUri, additionalImages: '[]' },
      });
    } catch (err: any) {
      Alert.alert('Camera error', err?.message ?? 'Could not capture photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [canScan, busy]);

  // ── Gallery ─────────────────────────────────────────────────────────────────
  const handleGallery = async () => {
    if (!canScan) return;
    hapticLight();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.92,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const savedUri = await saveImage(result.assets[0].uri);
      router.replace({ pathname: '/processing', params: { imageUri: savedUri, additionalImages: '[]' } });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Derived animation values ─────────────────────────────────────────────────
  const spreadTL  = cornerSpread.interpolate({ inputRange: [0, 1], outputRange: [0, -SPREAD_PX] });
  const spreadBR  = cornerSpread.interpolate({ inputRange: [0, 1], outputRange: [0,  SPREAD_PX] });
  const scanLineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, DOC_H - 2] });

  const frameColor = docReady ? '#00C896' : 'rgba(255,255,255,0.5)';
  const aiLabel    = busy
    ? 'CAPTURING...'
    : docReady
      ? 'READY TO CAPTURE ✓'
      : 'AI SCANNING FOR RECEIPT...';
  const aiColor = docReady ? '#00C896' : 'rgba(255,255,255,0.75)';

  // ── Permission gates ─────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    return (
      <View style={[styles.container, styles.permWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
        <MaterialCommunityIcons name="camera-off-outline" size={64} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permTitle}>Camera permission needed</Text>
        <Text style={styles.permBody}>
          TallyShot uses the camera to scan receipts. We only access it on this screen.
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
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 12, marginTop: 4 }} hitSlop={12}>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Live camera preview */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Vignette */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.vigTop} />
        <View style={{ flex: 1 }} />
        <View style={styles.vigBottom} />
      </View>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: 52 + insets.top }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.aiBadge, { opacity: badgeFade }]}>
          <View style={[styles.aiDot, { backgroundColor: docReady ? '#00C896' : t.accent }]} />
          <Text style={[styles.aiBadgeText, { color: aiColor }]}>{aiLabel}</Text>
        </Animated.View>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => { hapticLight(); router.push('/scan/product'); }}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="barcode-scan" size={22} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </View>

      {/* ── Document framing overlay ── */}
      <View style={styles.frameWrap} pointerEvents="none">

        {docReady && (
          <Animated.View
            style={[
              styles.glowRing,
              { width: DOC_W + 24, height: DOC_H + 24, opacity: detectedGlow, borderColor: '#00C896' },
            ]}
          />
        )}

        <View style={[styles.docFrame, { width: DOC_W, height: DOC_H }]}>

          <Animated.View style={[
            styles.corner, styles.cornerTL,
            { borderColor: frameColor, opacity: cornerPulse, transform: [{ translateX: spreadTL }, { translateY: spreadTL }] },
          ]} />
          <Animated.View style={[
            styles.corner, styles.cornerTR,
            { borderColor: frameColor, opacity: cornerPulse, transform: [{ translateX: spreadBR }, { translateY: spreadTL }] },
          ]} />
          <Animated.View style={[
            styles.corner, styles.cornerBL,
            { borderColor: frameColor, opacity: cornerPulse, transform: [{ translateX: spreadTL }, { translateY: spreadBR }] },
          ]} />
          <Animated.View style={[
            styles.corner, styles.cornerBR,
            { borderColor: frameColor, opacity: cornerPulse, transform: [{ translateX: spreadBR }, { translateY: spreadBR }] },
          ]} />

          <Animated.View
            style={[
              styles.scanLaser,
              {
                backgroundColor: docReady ? '#00C896' : t.accent,
                shadowColor:     docReady ? '#00C896' : t.accent,
                transform: [{ translateY: scanLineY }],
              },
            ]}
          />
        </View>

        <Text style={[styles.frameHint, { color: docReady ? '#00C896' : 'rgba(255,255,255,0.65)' }]}>
          {busy
            ? 'Saving photo…'
            : docReady
              ? 'Tap Capture when the receipt fills the frame'
              : 'Point camera at a receipt'}
        </Text>

        <View style={styles.instructionRow}>
          {['Fill the frame', 'Good light', 'Hold steady'].map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Scan limit banner */}
      {!canScan && (
        <TouchableOpacity
          style={styles.limitBanner}
          onPress={() => router.push('/paywall')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="crown-outline" size={16} color="#fbbf24" />
          <Text style={styles.limitText}>Monthly limit reached — tap to unlock unlimited scans</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(40, 16 + insets.bottom) }]}>

        <TouchableOpacity style={styles.sideBtn} onPress={handleGallery} activeOpacity={0.75}>
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={28}
            color={canScan ? '#fff' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[styles.sideBtnLabel, !canScan && { opacity: 0.3 }]}>Gallery</Text>
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
          <TouchableOpacity
            style={[styles.shutter, (!canScan || busy) && { opacity: 0.35 }]}
            onPress={takePhoto}
            disabled={!canScan || busy}
            activeOpacity={0.85}
          >
            <View style={[styles.shutterRing, { borderColor: docReady ? '#00C896' : t.cta }]}>
              {busy ? (
                <ActivityIndicator color={docReady ? '#00C896' : t.cta} />
              ) : (
                <View style={[styles.shutterInner, { backgroundColor: docReady ? '#00C896' : t.cta }]} />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => router.push({ pathname: '/review/[id]', params: { id: 'new' } })}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="pencil-plus-outline" size={28} color="#fff" />
          <Text style={styles.sideBtnLabel}>Manual</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080c10' },

  permWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  permTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 8, textAlign: 'center', color: '#fff' },
  permBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  permCta: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, minWidth: 200, alignItems: 'center' },
  permCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  vigTop:    { height: '18%', backgroundColor: 'rgba(0,0,0,0.65)' },
  vigBottom: { height: '28%', backgroundColor: 'rgba(0,0,0,0.65)' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  aiDot:      { width: 7, height: 7, borderRadius: 3.5 },
  aiBadgeText:{ fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.7 },

  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  glowRing: {
    position: 'absolute', borderRadius: CORNER_R + 8, borderWidth: 1.5,
  },
  docFrame: {
    borderRadius: CORNER_R,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    position: 'relative',
  },

  corner:     { position: 'absolute', width: CORNER_LEN, height: CORNER_LEN },
  cornerTL:   { top: -1,    left: -1,  borderTopWidth: CORNER_THICK,    borderLeftWidth: CORNER_THICK,  borderTopLeftRadius: CORNER_R },
  cornerTR:   { top: -1,    right: -1, borderTopWidth: CORNER_THICK,    borderRightWidth: CORNER_THICK, borderTopRightRadius: CORNER_R },
  cornerBL:   { bottom: -1, left: -1,  borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK,  borderBottomLeftRadius: CORNER_R },
  cornerBR:   { bottom: -1, right: -1, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: CORNER_R },

  scanLaser: {
    position: 'absolute', left: 20, right: 20, height: 1.5, borderRadius: 1,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 6,
  },

  frameHint: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 8,
  },
  instructionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)' },

  limitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(220,50,50,0.85)',
    marginHorizontal: 20, padding: 12, borderRadius: 12, marginBottom: 12,
  },
  limitText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 40, paddingTop: 20,
  },
  sideBtn:      { alignItems: 'center', gap: 5, width: 64 },
  sideBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  shutter:      { alignItems: 'center', justifyContent: 'center' },
  shutterRing:  { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32 },
});

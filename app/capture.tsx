/**
 * Capture screen — Step 2b
 *
 * Launches the native ML Kit Document Scanner (Android) / VisionKit (iOS)
 * which handles real-time edge detection, bounding-box overlay, auto-capture,
 * and perspective correction natively. We own the wrapper UI: branding,
 * flash option, gallery fallback, close button.
 *
 * Flow:
 *   FAB tap → this screen → native scanner launches immediately
 *   → scanner returns cropped image URI → /processing
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, StatusBar, Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, FREE_SCAN_LIMIT } from '../src/stores/appStore';
import { prewarmWorker } from '../src/services/extraction';
import { hapticMedium, hapticLight } from '../src/utils/haptics';
import { useThemeTokens } from '../src/theme';

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const t = useThemeTokens();
  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const canScan = isPro || scansUsedThisMonth < FREE_SCAN_LIMIT;

  const [launching, setLaunching] = useState(false);

  // Pre-warm AI worker so processing feels instant after scan.
  useEffect(() => { prewarmWorker(); }, []);

  // ── Save image to persistent app storage ────────────────────────────────
  const saveImage = async (uri: string): Promise<string> => {
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}receipt_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  // ── Native document scanner ──────────────────────────────────────────────
  const launchScanner = useCallback(async () => {
    if (!canScan || launching) return;
    setLaunching(true);
    hapticLight();
    try {
      const { scannedImages, status } = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
        maxNumDocuments: 5,       // multi-page receipts
      });

      if (status === 'cancel' || !scannedImages?.length) {
        // User cancelled — go back
        router.back();
        return;
      }

      hapticMedium();
      const savedUri = await saveImage(scannedImages[0]);

      // Additional pages stored separately (multi-page receipts — Step 9)
      const additionalUris: string[] = [];
      for (const uri of scannedImages.slice(1)) {
        additionalUris.push(await saveImage(uri));
      }

      router.replace({
        pathname: '/processing',
        params: {
          imageUri: savedUri,
          additionalImages: JSON.stringify(additionalUris),
        },
      });
    } catch (err: any) {
      Alert.alert('Scanner error', err?.message ?? 'Could not launch scanner. Please try again.');
      setLaunching(false);
    }
  }, [canScan, launching]);

  // Launch scanner automatically when the screen mounts.
  useEffect(() => {
    const t = setTimeout(launchScanner, 150); // slight delay avoids nav animation jank
    return () => clearTimeout(t);
  }, []);

  // ── Gallery fallback ────────────────────────────────────────────────────
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

  // ── While scanner is launching show a branded loading screen ────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: 52 + insets.top }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Receipt</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Phase 1 entry to product barcode scanner */}
      <TouchableOpacity
        onPress={() => { hapticLight(); router.push('/scan/product'); }}
        activeOpacity={0.85}
        style={[
          styles.productJump,
          { backgroundColor: t.surface + 'E6', borderColor: t.border },
        ]}
      >
        <MaterialCommunityIcons name="barcode-scan" size={18} color={t.accent} />
        <Text style={[styles.productJumpText, { color: t.textPrimary }]}>
          Or scan a product barcode
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={t.textMuted} />
      </TouchableOpacity>

      {/* Centre — loading state while scanner launches */}
      <View style={styles.centre}>
        {launching ? (
          <>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={styles.hint}>Opening scanner…</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="camera-plus-outline" size={72} color="rgba(255,255,255,0.25)" />
            <Text style={styles.hint}>Position your receipt in good light</Text>
            <Text style={styles.subHint}>
              The scanner will find the edges automatically
            </Text>
          </>
        )}
      </View>

      {/* Limit banner */}
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

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(40, 16 + insets.bottom) }]}>
        {/* Gallery */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={handleGallery}
          disabled={!canScan}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="image-multiple-outline" size={28} color={canScan ? '#fff' : 'rgba(255,255,255,0.3)'} />
          <Text style={[styles.sideBtnLabel, !canScan && { opacity: 0.3 }]}>Gallery</Text>
        </TouchableOpacity>

        {/* Main scan button — re-launches scanner if user returned without scanning */}
        <TouchableOpacity
          style={[styles.shutter, !canScan && { opacity: 0.35 }]}
          onPress={launchScanner}
          disabled={!canScan || launching}
          activeOpacity={0.8}
        >
          <View style={[styles.shutterRing, { borderColor: t.cta }]}>
            {launching
              ? <ActivityIndicator size="small" color={t.accent} />
              : <View style={[styles.shutterInner, { backgroundColor: t.cta }]} />
            }
          </View>
        </TouchableOpacity>

        {/* Manual entry */}
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
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  hint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 8,
  },
  subHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,50,50,0.85)',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  limitText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  sideBtn: {
    alignItems: 'center',
    gap: 5,
    width: 64,
  },
  sideBtnLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  shutter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    // borderColor comes from theme tokens (t.cta) — applied inline above
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    // backgroundColor comes from theme tokens (t.cta) — applied inline above
  },
  productJump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  productJumpText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
});

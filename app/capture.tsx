import { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, FREE_SCAN_LIMIT } from '../src/stores/appStore';
import { prewarmWorker } from '../src/services/extraction';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);

  const insets = useSafeAreaInsets();
  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const photoMode = useAppStore((s) => s.photoMode);

  const canScan = isPro || scansUsedThisMonth < FREE_SCAN_LIMIT;

  // Original (default): no filters / no auto-adjust — best OCR on thermal-paper
  // receipts. Counters SparkReceipt's review pattern where aggressive default
  // filtering hurt OCR (Peter Hawthorne, Feb 2026).
  // Enhanced: keeps a higher-fidelity photo so the AI sees more detail. The
  // expo-image-manipulator API doesn't expose de-skew or contrast directly,
  // so true OCR-enhancement filters (de-skew, adaptive contrast) are deferred
  // to v1.1 once we add a frame-processor library. The toggle still gives
  // users meaningful control today.
  const captureQuality = photoMode === 'enhanced' ? 0.95 : 0.85;

  // Pre-warm the Worker so the actual scan feels instant.
  // Best-effort fire-and-forget — silently ignored if it fails.
  useEffect(() => {
    prewarmWorker();
  }, []);

  const saveImage = async (uri: string): Promise<string> => {
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}receipt_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  const handleCapture = useCallback(async () => {
    if (!canScan || capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: captureQuality,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('No photo captured');
      const savedUri = await saveImage(photo.uri);
      router.replace({ pathname: '/processing', params: { imageUri: savedUri } });
    } catch (err: any) {
      Alert.alert('Capture failed', err.message ?? 'Could not take photo');
      setCapturing(false);
    }
  }, [canScan, capturing]);

  const handleGallery = async () => {
    if (!canScan) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: captureQuality,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const savedUri = await saveImage(result.assets[0].uri);
      router.replace({ pathname: '/processing', params: { imageUri: savedUri } });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Permission loading
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permContainer]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <MaterialCommunityIcons name="camera-off" size={72} color="rgba(255,255,255,0.4)" />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          TallyShot needs camera access to photograph receipts.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryBtn} onPress={handleGallery}>
          <MaterialCommunityIcons name="image" size={20} color="white" />
          <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="close" size={26} color="white" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan Receipt</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
        >
          <MaterialCommunityIcons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={26}
            color={flash === 'on' ? '#FFD700' : 'white'}
          />
        </TouchableOpacity>
      </View>

      {/* Viewfinder frame */}
      <View style={styles.frameContainer}>
        <View style={styles.frame}>
          {/* Corners */}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.frameHint}>Position receipt within frame</Text>
      </View>

      {/* Limit banner */}
      {!canScan && (
        <View style={styles.limitBanner}>
          <MaterialCommunityIcons name="lock" size={16} color="white" />
          <Text style={styles.limitText}>
            Monthly AI limit reached — you can still add receipts manually
          </Text>
        </View>
      )}

      {/* Add manually — always available */}
      <TouchableOpacity
        style={styles.manualBtn}
        onPress={() => router.push({ pathname: '/review/[id]', params: { id: 'new' } })}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="pencil-plus-outline" size={16} color="white" />
        <Text style={styles.manualBtnText}>Add manually</Text>
      </TouchableOpacity>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(48, 20 + insets.bottom) }]}>
        {/* Gallery button */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={handleGallery}
          disabled={!canScan}
        >
          <MaterialCommunityIcons name="image-multiple" size={28} color="white" />
          <Text style={styles.sideBtnLabel}>Gallery</Text>
        </TouchableOpacity>

        {/* Shutter */}
        <TouchableOpacity
          style={[styles.shutter, (!canScan || capturing) && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={!canScan || capturing}
          activeOpacity={0.8}
        >
          <View style={styles.shutterRing}>
            <View style={[styles.shutterInner, capturing && { backgroundColor: '#ff4444' }]} />
          </View>
        </TouchableOpacity>

        {/* Flip camera */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <MaterialCommunityIcons name="camera-flip" size={28} color="white" />
          <Text style={styles.sideBtnLabel}>Flip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  permTitle: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  permBody: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 8,
  },
  permBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  galleryBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  closeBtn: { position: 'absolute', top: 56, right: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topTitle: { color: 'white', fontSize: 17, fontWeight: '600', letterSpacing: 0.3 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  frame: {
    width: '78%',
    aspectRatio: 0.68,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: 'white',
    borderRadius: 2,
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH },
  frameHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    letterSpacing: 0.2,
  },

  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,50,50,0.85)',
    marginHorizontal: 24,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  limitText: { color: 'white', fontSize: 13, flex: 1 },

  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginBottom: 12,
  },
  manualBtnText: { color: 'white', fontSize: 13, fontWeight: '500' },


  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 20,
    // paddingBottom set dynamically via insets in JSX
  },
  sideBtn: { alignItems: 'center', gap: 4, width: 60 },
  sideBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  shutter: { alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.35 },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
  },
});

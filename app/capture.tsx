import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  FlashMode,
  BarcodeScanningResult,
  scanFromURLAsync,
} from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, FREE_SCAN_LIMIT } from '../src/stores/appStore';
import { prewarmWorker } from '../src/services/extraction';
import {
  Detection,
  LOCK_CONFIDENCE,
  detectDocument,
  readIngredientsFromPhoto,
} from '../src/services/detection';
import {
  findProduct,
  aiGuessProduct,
  findAlternatives,
  cardToExtraction,
  normaliseBarcodeType,
  withPhotographedIngredients,
  isRetailBarcode,
  type ProductCard,
  type Alternative,
} from '../src/services/productLookup';
import { addScanToHistory } from '../src/db/scanHistory';
import ScannerOverlay, { ScanMode } from '../src/components/ScannerOverlay';
import ProductCardView from '../src/components/ProductCard';
import BarcodePicker, { type DetectedCode, type FrozenFrame } from '../src/components/BarcodePicker';
import { hapticLight, hapticMedium } from '../src/utils/haptics';

/** How often the AI assist loop asks "where's the receipt?" while hunting. */
const DETECT_INTERVAL_MS = 3200;

/**
 * Slower cadence once we have a good lock. The box only needs refreshing in
 * case the user moves the phone, and each poll is a real API call.
 */
const DETECT_IDLE_INTERVAL_MS = 6500;

/**
 * Stop the loop after this many polls with no capture.
 *
 * Each poll is a real API call, so an abandoned camera screen would otherwise
 * bill for as long as it stays open — and detect polls aren't counted against
 * the free scan limit. Suspending after ~45s bounds the cost per camera
 * session instead of per minute. Tapping the viewfinder resumes it.
 */
const MAX_IDLE_POLLS = 12;

/** Zoom presets. expo-camera's zoom is a normalised 0-1 value, not a factor. */
const ZOOM_STEPS = [
  { label: '1×', value: 0 },
  { label: '2×', value: 0.14 },
  { label: '3×', value: 0.32 },
];

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code93',
  'code128',
  'itf14',
  'codabar',
  'qr',
  'pdf417',
  'datamatrix',
  'aztec',
] as const;

/**
 * How many consecutive frames must decode to the *same* value before we act.
 *
 * This is the blur defence. expo-camera's `autofocus` prop is iOS-only, so on
 * Android there is no way to ask the camera whether focus has settled — but a
 * barcode read off a blurry or half-focused frame is unstable, and one read
 * off a settled frame repeats. Three identical reads in a row is a decent
 * proxy for "focus has stopped moving", and it costs a few hundred
 * milliseconds rather than a wrong product.
 */
const STABLE_READS = 3;

/**
 * Barcode mode's state machine.
 *
 *   hunting    → live preview, watching for a stable read
 *   confirming → preview frozen on a still, user picks which code they meant
 *   looking    → free database chain in flight
 *   result     → a product card is up
 *   notfound   → chain finished with nothing; offer AI guess / manual entry
 *   ingredients→ back at the camera, aimed at an ingredients panel
 */
type ScanPhase =
  | { kind: 'hunting' }
  | { kind: 'confirming'; frame: FrozenFrame }
  | { kind: 'looking'; code: string; type: string }
  | { kind: 'result'; card: ProductCard }
  | { kind: 'notfound'; code: string; type: string; incomplete: boolean }
  | { kind: 'ingredients'; card: ProductCard };

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  // Opened from scan history as /capture?rescan=<barcode>: start in barcode
  // mode and re-run the lookup, which the on-device cache answers instantly.
  const { rescan } = useLocalSearchParams<{ rescan?: string }>();
  const [mode, setMode] = useState<ScanMode>(rescan ? 'barcode' : 'receipt');
  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [aiSuspended, setAiSuspended] = useState(false);
  const [sourceAspect, setSourceAspect] = useState<number | undefined>(undefined);

  /**
   * Barcode mode runs as an explicit state machine rather than a pile of
   * booleans, because the states genuinely exclude one another: you cannot be
   * confirming a frozen frame and hunting live at the same time, and the old
   * boolean soup made that easy to get wrong.
   */
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'hunting' });
  /** Paid AI-guess call in flight (user-triggered). */
  const [aiLooking, setAiLooking] = useState(false);
  /** Ingredients-from-photo call in flight (user-triggered). */
  const [readingIngredients, setReadingIngredients] = useState(false);
  /** null = not asked yet; [] = asked and there were none. */
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isFocused = useIsFocused();

  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const photoMode = useAppStore((s) => s.photoMode);
  const aiAssist = useAppStore((s) => s.aiAssist);
  const setAiAssist = useAppStore((s) => s.setAiAssist);
  const currency = useAppStore((s) => s.currency);
  const incrementScanCount = useAppStore((s) => s.incrementScanCount);
  const instantScan = useAppStore((s) => s.instantScan);
  const dietaryFlags = useAppStore((s) => s.dietaryFlags);

  const canScan = isPro || scansUsedThisMonth < FREE_SCAN_LIMIT;

  // Guards shared between the capture path and the detect loop so the two
  // never ask the camera for a frame at the same time.
  const busyRef = useRef(false);
  const detectSeq = useRef(0);

  /** The code the last live read decoded, and how many times running. */
  const stableCodeRef = useRef<string | null>(null);
  const stableCountRef = useRef(0);
  /** The frozen still on disk, so it can be deleted when we move on. */
  const frameUriRef = useRef<string | null>(null);
  /** Latest live read, shown in the viewfinder chip while still hunting. */
  const [liveCode, setLiveCode] = useState<string | null>(null);
  /** Was the previous poll a lock? Used so the haptic fires on the transition
   *  into a lock, not on every poll that happens to still be locked. */
  const wasLockedRef = useRef(false);

  // Original (default): no filters / no auto-adjust — best OCR on thermal-paper
  // receipts. Counters SparkReceipt's review pattern where aggressive default
  // filtering hurt OCR (Peter Hawthorne, Feb 2026).
  // Enhanced: keeps a higher-fidelity photo so the AI sees more detail.
  const captureQuality = photoMode === 'enhanced' ? 0.95 : 0.85;

  const lockedBox =
    detection?.found && detection.confidence >= LOCK_CONFIDENCE ? detection.box : null;

  // Pre-warm the Worker so the actual scan feels instant.
  useEffect(() => {
    prewarmWorker();
  }, []);

  /**
   * Narrowed phase for dependency arrays. `phase` itself is a new object on
   * every transition, so depending on the whole thing would rebuild the
   * barcode callback constantly and reset the camera's scanner.
   */
  const phaseKind = phase.kind;

  /** Delete the frozen still. Best-effort — a leftover temp file is harmless. */
  const discardFrame = useCallback(() => {
    const uri = frameUriRef.current;
    frameUriRef.current = null;
    if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, []);

  const saveImage = async (uri: string): Promise<string> => {
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}receipt_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  /**
   * Grab a throwaway frame and ask the AI where the receipt is.
   *
   * `skipProcessing` stays false on purpose: with it on, Android hands back an
   * unrotated sensor image, so the box coordinates would come back in a
   * different orientation than the preview and land in the wrong place.
   */
  const runDetect = useCallback(async () => {
    if (busyRef.current || !cameraRef.current || !ready) return;
    busyRef.current = true;
    const seq = ++detectSeq.current;
    setDetecting(true);
    let frameUri: string | null = null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        skipProcessing: false,
        shutterSound: false,
      });
      if (!photo?.uri) return;
      frameUri = photo.uri;
      if (photo.width && photo.height) setSourceAspect(photo.width / photo.height);

      const result = await detectDocument(photo.uri);
      // A newer detect started while this one was in flight — drop this result.
      if (seq !== detectSeq.current) return;

      setDetection(result);
      const isLock = result.found && result.confidence >= LOCK_CONFIDENCE;
      if (isLock && !wasLockedRef.current) hapticLight();
      wasLockedRef.current = isLock;
    } catch {
      // Detection is a convenience, never a blocker. Leave the last known
      // state alone and let the next poll try again.
    } finally {
      if (frameUri) FileSystem.deleteAsync(frameUri, { idempotent: true }).catch(() => {});
      busyRef.current = false;
      if (seq === detectSeq.current) setDetecting(false);
    }
  }, [ready]);

  // AI assist polling loop. Only runs while this screen is focused, in receipt
  // mode, with the toggle on — so it can't quietly burn API calls in the
  // background or behind the paywall.
  useEffect(() => {
    if (!aiAssist || aiSuspended || mode !== 'receipt' || !isFocused || !ready || !canScan) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      await runDetect();
      if (cancelled) return;
      if (++polls >= MAX_IDLE_POLLS) {
        setAiSuspended(true);
        return;
      }
      const next = wasLockedRef.current ? DETECT_IDLE_INTERVAL_MS : DETECT_INTERVAL_MS;
      timer = setTimeout(tick, next);
    };
    timer = setTimeout(tick, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [aiAssist, aiSuspended, mode, isFocused, ready, canScan, runDetect]);

  // Reset per-mode state when switching so stale boxes don't linger.
  useEffect(() => {
    setDetection(null);
    setPhase({ kind: 'hunting' });
    setLiveCode(null);
    setAlternatives(null);
    stableCodeRef.current = null;
    stableCountRef.current = 0;
    discardFrame();
    detectSeq.current++;
    wasLockedRef.current = false;
  }, [mode, discardFrame]);

  // Leaving the screen with a frozen frame on disk would leak a temp file.
  useEffect(() => discardFrame, [discardFrame]);

  const handleCapture = useCallback(async () => {
    if (!canScan || capturing || busyRef.current || !cameraRef.current) return;
    setCapturing(true);
    busyRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: captureQuality,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('No photo captured');
      const savedUri = await saveImage(photo.uri);
      hapticMedium();
      router.replace({
        pathname: '/processing',
        params: {
          imageUri: savedUri,
          // Hand the lock-on box to processing so it can crop to the paper
          // before extraction.
          ...(lockedBox ? { cropBox: JSON.stringify(lockedBox) } : {}),
        },
      });
    } catch (err: any) {
      Alert.alert('Capture failed', err.message ?? 'Could not take photo');
      setCapturing(false);
    } finally {
      busyRef.current = false;
    }
  }, [canScan, capturing, captureQuality, lockedBox]);

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

  /**
   * The free half of the lookup chain — no button press, no AI-scan cost, no
   * scan-limit gate. Only the AI guess costs anything, so only it is gated.
   */
  const runDbLookup = useCallback(async (code: string, type: string) => {
    setPhase({ kind: 'looking', code, type });
    setAlternatives(null);
    try {
      const { card, incomplete } = await findProduct(code, type);
      if (card) {
        hapticMedium();
        setPhase({ kind: 'result', card });
        addScanToHistory(card);
      } else {
        setPhase({ kind: 'notfound', code, type, incomplete });
      }
    } catch {
      // Offline or every API down — same outcome as a miss: the user still
      // gets AI-guess and manual entry, never a dead end.
      setPhase({ kind: 'notfound', code, type, incomplete: true });
    }
  }, []);

  // Re-open a product from scan history. Runs once; the barcode type is not in
  // the URL, so pass the code itself and let canonicalBarcode work it out from
  // the digit count.
  const rescanDone = useRef(false);
  useEffect(() => {
    if (!rescan || rescanDone.current) return;
    rescanDone.current = true;
    runDbLookup(rescan, 'ean13');
  }, [rescan, runDbLookup]);

  /**
   * Freeze the preview on a still and find every barcode in it.
   *
   * The live callback can only ever report one code per frame — expo-camera's
   * Android analyzer keeps `barcodes.first()` and drops the rest before they
   * reach JavaScript — so the multi-barcode picker has to work off a captured
   * still, where `scanFromURLAsync` returns the full list.
   */
  const freezeAndConfirm = useCallback(
    async (fallback: { data: string; type: string }) => {
      if (busyRef.current || !cameraRef.current) return;
      busyRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          skipProcessing: false,
          shutterSound: false,
        });
        if (!photo?.uri) throw new Error('no frame');

        cameraRef.current.pausePreview?.();
        frameUriRef.current = photo.uri;

        let codes: DetectedCode[] = [];
        try {
          const found = await scanFromURLAsync(photo.uri, [...BARCODE_TYPES]);
          codes = found
            .map((f: any) => ({
              data: String(f?.data ?? ''),
              type: normaliseBarcodeType(f?.type),
              box: f?.bounds?.size?.width
                ? {
                    x: f.bounds.origin.x,
                    y: f.bounds.origin.y,
                    width: f.bounds.size.width,
                    height: f.bounds.size.height,
                  }
                : null,
            }))
            .filter((c: DetectedCode) => c.data);
        } catch {
          // ML Kit unavailable on this device, or the still would not load.
          // Fall through to the live read rather than dead-ending.
        }

        // The still missed what the live scanner saw (motion, glare). Keep the
        // live read so the user still gets a confirm step rather than nothing.
        if (codes.length === 0) {
          codes = [{ data: fallback.data, type: fallback.type, box: null }];
        }

        hapticLight();
        setPhase({
          kind: 'confirming',
          frame: {
            uri: photo.uri,
            width: photo.width ?? 0,
            height: photo.height ?? 0,
            codes,
          },
        });
      } catch {
        // Could not grab a still — act on the live read, which is still better
        // than appearing to do nothing.
        runDbLookup(fallback.data, fallback.type);
      } finally {
        busyRef.current = false;
      }
    },
    [runDbLookup]
  );

  /**
   * Live barcode callback. The camera fires this continuously while a code is
   * in view, so it holds a stability count and refuses to act unless we are
   * actually hunting.
   */
  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (phaseKind !== 'hunting' || busyRef.current) return;

      const data = result.data;
      if (!data) return;
      const type = normaliseBarcodeType(result.type);

      // Same code again? Count it. A different code means the camera is still
      // settling or the user is still aiming, so start the count over.
      if (stableCodeRef.current === data) {
        stableCountRef.current += 1;
      } else {
        stableCodeRef.current = data;
        stableCountRef.current = 1;
      }
      setLiveCode(data);

      if (stableCountRef.current < STABLE_READS) return;
      stableCountRef.current = 0;
      stableCodeRef.current = null;

      if (instantScan) {
        hapticMedium();
        runDbLookup(data, type);
      } else {
        freezeAndConfirm({ data, type });
      }
    },
    [phaseKind, instantScan, runDbLookup, freezeAndConfirm]
  );

  /** User tapped one of the highlighted codes on the frozen frame. */
  const pickCode = useCallback(
    (code: DetectedCode) => {
      hapticMedium();
      cameraRef.current?.resumePreview?.();
      discardFrame();
      runDbLookup(code.data, code.type);
    },
    [runDbLookup, discardFrame]
  );

  const handleAiGuess = async () => {
    if (phase.kind !== 'notfound' || !canScan) return;
    const { code, type } = phase;
    setAiLooking(true);
    try {
      const card = await aiGuessProduct(code, type, currency);
      setPhase({ kind: 'result', card });
      addScanToHistory(card);
      incrementScanCount();
    } catch (err: any) {
      Alert.alert('Lookup failed', err?.message ?? 'Could not identify this barcode');
    } finally {
      setAiLooking(false);
    }
  };

  /** Photograph the ingredients panel and transcribe it onto the card. */
  const captureIngredients = async () => {
    if (phase.kind !== 'ingredients' || busyRef.current || !cameraRef.current) return;
    if (!canScan) {
      router.push('/paywall');
      return;
    }
    const card = phase.card;
    busyRef.current = true;
    setReadingIngredients(true);
    let uri: string | null = null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('Could not take the photo');
      uri = photo.uri;

      const read = await readIngredientsFromPhoto(photo.uri);
      if (!read.found || !read.ingredients_text.trim()) {
        Alert.alert(
          'No ingredients found',
          read.note?.trim() ||
            'Could not find an ingredient list in that photo. Try filling the frame with the list.'
        );
        setPhase({ kind: 'result', card });
        return;
      }

      incrementScanCount();
      hapticMedium();
      setPhase({ kind: 'result', card: withPhotographedIngredients(card, read.ingredients_text) });
      if (read.unreadable_parts && read.note?.trim()) {
        Alert.alert('Partly readable', read.note.trim());
      }
    } catch (err: any) {
      Alert.alert('Could not read the pack', err?.message ?? 'Please try again.');
      setPhase({ kind: 'result', card });
    } finally {
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      busyRef.current = false;
      setReadingIngredients(false);
    }
  };

  const showAlternatives = async () => {
    if (phase.kind !== 'result') return;
    setLoadingAlternatives(true);
    try {
      setAlternatives(await findAlternatives(phase.card));
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  /** Back to hunting, with the frozen still cleaned up. */
  const resetBarcode = useCallback(() => {
    cameraRef.current?.resumePreview?.();
    discardFrame();
    stableCodeRef.current = null;
    stableCountRef.current = 0;
    setLiveCode(null);
    setAlternatives(null);
    setPhase({ kind: 'hunting' });
  }, [discardFrame]);

  /** Manual entry that keeps the scanned barcode attached to the receipt. */
  const manualWithBarcode = () => {
    if (phase.kind !== 'notfound') return;
    router.push({
      pathname: '/review/[id]',
      params: {
        id: 'new',
        extraction: JSON.stringify({
          merchant: '',
          date: new Date().toLocaleDateString('en-CA'),
          currency,
          line_items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          payment_method: null,
          invoice_number: phase.code,
          suggested_category: 'Other',
        }),
      },
    });
  };

  const useLookupResult = () => {
    if (phase.kind !== 'result') return;
    router.replace({
      pathname: '/review/[id]',
      params: {
        id: 'new',
        extraction: JSON.stringify(cardToExtraction(phase.card, currency)),
      },
    });
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
        <Text style={styles.permBody}>TallyShot needs camera access to photograph receipts.</Text>
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

  const flashIcon = flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-auto' : 'flash-off';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        enableTorch={torch}
        zoom={ZOOM_STEPS[zoomIndex].value}
        animateShutter={false}
        active={isFocused}
        onCameraReady={() => setReady(true)}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={mode === 'barcode' ? onBarcodeScanned : undefined}
      />

      {/* Tapping the viewfinder runs a one-shot AI find — the manual version
          of AI assist, so it's useful even with the toggle off. */}
      {mode === 'receipt' && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!canScan) return;
            hapticLight();
            // A tap is an explicit "I'm still here" — resume the loop if it
            // suspended itself, and run one detect right now either way.
            if (aiSuspended) setAiSuspended(false);
            runDetect();
          }}
        />
      )}

      {/* The viewfinder overlay only makes sense while we are still hunting;
          once the frame is frozen the picker owns the screen. */}
      {phase.kind === 'hunting' && (
        <ScannerOverlay
          mode={mode}
          detection={detection}
          detecting={detecting}
          aiAssist={aiAssist}
          aiSuspended={aiSuspended}
          sourceAspect={sourceAspect}
          barcodeValue={liveCode}
          barcodeBox={null}
        />
      )}

      {/* Frozen frame + tappable barcodes */}
      {mode === 'barcode' && phase.kind === 'confirming' && (
        <BarcodePicker
          frame={phase.frame}
          viewWidth={winW}
          viewHeight={winH}
          onPick={pickCode}
          onCancel={resetBarcode}
        />
      )}

      {/* Aiming at an ingredients panel */}
      {mode === 'barcode' && phase.kind === 'ingredients' && (
        <View style={styles.ingredientsOverlay} pointerEvents="none">
          <View style={styles.ingredientsHint}>
            <MaterialCommunityIcons name="text-recognition" size={18} color="#f59e0b" />
            <Text style={styles.ingredientsHintText}>
              Fill the frame with the ingredients list, then tap the shutter
            </Text>
          </View>
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="close" size={24} color="white" />
        </TouchableOpacity>

        {/* Mode switch */}
        <View style={styles.segment}>
          {(['receipt', 'barcode'] as ScanMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
              onPress={() => {
                if (mode === m) return;
                hapticLight();
                setMode(m);
              }}
              activeOpacity={0.9}
            >
              <MaterialCommunityIcons
                name={m === 'receipt' ? 'receipt' : 'barcode-scan'}
                size={14}
                color={mode === m ? '#000' : 'rgba(255,255,255,0.75)'}
              />
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'receipt' ? 'Receipt' : 'Barcode'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'barcode' ? (
          <TouchableOpacity
            style={[styles.iconBtn, torch && styles.iconBtnOn]}
            onPress={() => {
              hapticLight();
              setTorch((t) => !t);
            }}
          >
            <MaterialCommunityIcons
              name={torch ? 'flashlight' : 'flashlight-off'}
              size={22}
              color={torch ? '#000' : 'white'}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.iconBtn, flash !== 'off' && styles.iconBtnOn]}
            onPress={() => {
              hapticLight();
              setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'));
            }}
          >
            <MaterialCommunityIcons
              name={flashIcon}
              size={22}
              color={flash !== 'off' ? '#000' : 'white'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Right-hand control rail */}
      <View style={[styles.rail, { top: insets.top + 78 }]}>
        {mode === 'receipt' && (
          <TouchableOpacity
            style={[
              styles.railBtn,
              aiAssist && styles.railBtnOn,
              aiAssist && aiSuspended && styles.railBtnPaused,
            ]}
            onPress={() => {
              hapticLight();
              setAiAssist(!aiAssist);
              setAiSuspended(false);
              if (aiAssist) {
                setDetection(null);
                wasLockedRef.current = false;
              }
            }}
            activeOpacity={0.85}
          >
            {detecting ? (
              <ActivityIndicator size="small" color={aiAssist ? '#000' : 'white'} />
            ) : (
              <MaterialCommunityIcons
                name={aiAssist && aiSuspended ? 'play' : 'auto-fix'}
                size={20}
                color={aiAssist ? '#000' : 'white'}
              />
            )}
            <Text style={[styles.railLabel, aiAssist && styles.railLabelOn]}>AI</Text>
          </TouchableOpacity>
        )}

        <View style={styles.zoomStack}>
          {ZOOM_STEPS.map((step, i) => (
            <TouchableOpacity
              key={step.label}
              style={[styles.zoomBtn, zoomIndex === i && styles.zoomBtnActive]}
              onPress={() => {
                hapticLight();
                setZoomIndex(i);
              }}
            >
              <Text style={[styles.zoomText, zoomIndex === i && styles.zoomTextActive]}>
                {step.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bottom stack */}
      <View style={styles.bottomStack}>
        {!canScan && mode === 'receipt' && (
          <TouchableOpacity
            style={styles.limitBanner}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="crown" size={16} color="#fbbf24" />
            <Text style={styles.limitText}>
              Monthly limit reached — tap to unlock unlimited scans
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color="white" />
          </TouchableOpacity>
        )}

        {lockedBox && mode === 'receipt' && (
          <View style={styles.cropNote}>
            <MaterialCommunityIcons name="crop" size={14} color="#34c759" />
            <Text style={styles.cropNoteText}>Auto-crop armed — capture will zoom to the paper</Text>
          </View>
        )}

        {mode === 'receipt' && (
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: 'new' } })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="pencil-plus-outline" size={16} color="white" />
            <Text style={styles.manualBtnText}>Add manually</Text>
          </TouchableOpacity>
        )}

        {/* Barcode mode: the card (or its loading / not-found states) replaces
            the shutter row. Hunting and confirming keep the camera clear. */}
        {mode === 'barcode' && phase.kind === 'result' ? (
          <View
            style={[
              styles.card,
              styles.cardTall,
              { marginBottom: Math.max(24, insets.bottom + 12) },
            ]}
          >
            <TouchableOpacity style={styles.cardClose} onPress={resetBarcode} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <ProductCardView
              card={phase.card}
              currency={currency}
              userFlags={dietaryFlags}
              scansLeft={isPro ? null : Math.max(0, FREE_SCAN_LIMIT - scansUsedThisMonth)}
              onUse={useLookupResult}
              onScanAnother={resetBarcode}
              onReadIngredientsFromPack={() => {
                hapticLight();
                cameraRef.current?.resumePreview?.();
                setPhase({ kind: 'ingredients', card: phase.card });
              }}
              readingIngredients={readingIngredients}
              onShowAlternatives={showAlternatives}
              alternatives={alternatives}
              loadingAlternatives={loadingAlternatives}
            />
          </View>
        ) : mode === 'barcode' && phase.kind === 'looking' ? (
          <View style={[styles.card, { marginBottom: Math.max(24, insets.bottom + 12) }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="barcode" size={18} color="#f59e0b" />
              <Text style={styles.cardCode} numberOfLines={1}>
                {phase.code}
              </Text>
              <TouchableOpacity onPress={resetBarcode} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardNote}>Checking free product databases…</Text>
            <ActivityIndicator
              size="small"
              color="rgba(255,255,255,0.8)"
              style={{ marginVertical: 10 }}
            />
          </View>
        ) : mode === 'barcode' && phase.kind === 'notfound' ? (
          <View style={[styles.card, { marginBottom: Math.max(24, insets.bottom + 12) }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="barcode" size={18} color="#f59e0b" />
              <Text style={styles.cardCode} numberOfLines={1}>
                {phase.code}
              </Text>
              <TouchableOpacity onPress={resetBarcode} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardTitle}>
              {phase.incomplete ? "Couldn't check every database" : 'Not in any database yet'}
            </Text>
            <Text style={styles.cardNote}>
              {phase.incomplete
                ? 'We hit the free databases\u2019 rate limit, so this might still be findable in a minute. Try again shortly, or carry on below.'
                : !isRetailBarcode(phase.code, phase.type)
                  ? 'That is not a retail product barcode, so no product database will list it. You can still ask the AI or type the details in.'
                  : 'We checked the free worldwide product databases. Ask the AI for a best guess, or type the details yourself \u2014 the barcode stays saved either way.'}
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!canScan || aiLooking) && styles.btnDisabled]}
              onPress={handleAiGuess}
              disabled={!canScan || aiLooking}
            >
              {aiLooking ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>Ask AI for a guess</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={manualWithBarcode}>
              <Text style={styles.secondaryBtnText}>Type details myself</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetBarcode}>
              <Text style={styles.secondaryBtnText}>Scan another</Text>
            </TouchableOpacity>
          </View>
        ) : mode === 'barcode' && phase.kind === 'confirming' ? null : (
          <View
            style={[styles.bottomBar, { paddingBottom: Math.max(36, 18 + insets.bottom) }]}
          >
            {phase.kind === 'ingredients' ? (
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => setPhase({ kind: 'result', card: phase.card })}
              >
                <MaterialCommunityIcons name="arrow-left" size={26} color="white" />
                <Text style={styles.sideBtnLabel}>Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.sideBtn} onPress={handleGallery} disabled={!canScan}>
                <MaterialCommunityIcons name="image-multiple" size={26} color="white" />
                <Text style={styles.sideBtnLabel}>Gallery</Text>
              </TouchableOpacity>
            )}

            {mode === 'receipt' ? (
              <TouchableOpacity
                style={[styles.shutter, (!canScan || capturing) && styles.shutterDisabled]}
                onPress={handleCapture}
                disabled={!canScan || capturing}
                activeOpacity={0.8}
              >
                <View style={[styles.shutterRing, lockedBox && styles.shutterRingLocked]}>
                  <View
                    style={[
                      styles.shutterInner,
                      lockedBox && styles.shutterInnerLocked,
                      capturing && { backgroundColor: '#ff4444' },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ) : phase.kind === 'ingredients' ? (
              <TouchableOpacity
                style={[styles.shutter, readingIngredients && styles.shutterDisabled]}
                onPress={captureIngredients}
                disabled={readingIngredients}
                activeOpacity={0.8}
              >
                <View style={styles.shutterRing}>
                  {readingIngredients ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View style={styles.shutterInner} />
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.scanHintWrap}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                <Text style={styles.scanHint}>
                  {liveCode ? 'Hold steady…' : 'Scanning for barcodes…'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            >
              <MaterialCommunityIcons name="camera-flip" size={26} color="white" />
              <Text style={styles.sideBtnLabel}>Flip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  permTitle: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  permBody: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: '#818cf8',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 8,
  },
  permBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  galleryBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  closeBtn: { position: 'absolute', top: 56, right: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },

  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 17,
  },
  segmentBtnActive: { backgroundColor: 'white' },
  segmentText: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '600' },
  segmentTextActive: { color: '#000', fontWeight: '700' },

  rail: { position: 'absolute', right: 14, alignItems: 'center', gap: 14 },
  railBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  railBtnOn: { backgroundColor: '#818cf8', borderColor: '#818cf8' },
  railBtnPaused: { backgroundColor: 'rgba(129,140,248,0.55)', borderColor: 'rgba(129,140,248,0.8)' },
  railLabel: { color: 'white', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },
  railLabelOn: { color: '#000' },

  zoomStack: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  zoomBtn: { width: 34, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  zoomBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  zoomText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' },
  zoomTextActive: { color: '#000' },

  bottomStack: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,50,50,0.88)',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  limitText: { color: 'white', fontSize: 13, flex: 1 },

  cropNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(52,199,89,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,199,89,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginBottom: 10,
  },
  cropNoteText: { color: '#8ff0ab', fontSize: 11.5, fontWeight: '600' },

  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginBottom: 10,
  },
  manualBtnText: { color: 'white', fontSize: 13, fontWeight: '500' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    paddingTop: 14,
  },
  sideBtn: { alignItems: 'center', gap: 4, width: 62 },
  sideBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  scanHintWrap: { alignItems: 'center', gap: 8, width: 150 },
  scanHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  shutter: { alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.35 },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingLocked: { borderColor: '#34c759' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'white' },
  shutterInnerLocked: { backgroundColor: '#34c759' },

  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,20,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 6,
  },
  // The full product card needs room; capped so the viewfinder stays visible
  // above it and the user can see they are still pointing at something.
  cardTall: { maxHeight: '78%', paddingTop: 30 },
  cardClose: { position: 'absolute', top: 8, right: 10, zIndex: 2, padding: 4 },

  ingredientsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-start' },
  ingredientsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 120,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.5)',
  },
  ingredientsHintText: { color: 'white', fontSize: 12.5, flexShrink: 1, lineHeight: 17 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCode: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  cardTitle: { color: 'white', fontSize: 17, fontWeight: '700', marginTop: 2 },
  cardSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  cardNote: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 17, marginTop: 2 },
  attribution: { color: 'rgba(255,255,255,0.4)', fontSize: 10.5, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metaChipText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 40, marginTop: 2 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },
});

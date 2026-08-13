import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Detection, DetectionBox, LOCK_CONFIDENCE, QUALITY_LABEL } from '../services/detection';

export type ScanMode = 'receipt' | 'barcode';

export interface ScannerOverlayProps {
  mode: ScanMode;
  /** Latest AI detection, or null when nothing has been found yet. */
  detection: Detection | null;
  /** True while a detect round-trip is in flight. */
  detecting: boolean;
  /** True when the AI auto-scan loop is enabled. */
  aiAssist: boolean;
  /** True when the loop paused itself after too many polls with no capture. */
  aiSuspended?: boolean;
  /**
   * Aspect ratio (width / height) of the still frame the detection came from.
   * The preview is a cover-fit crop of that frame, so without this the box
   * would sit in the wrong place on any phone whose screen isn't 4:3.
   */
  sourceAspect?: number;
  /** Live barcode value, if one is currently in view. */
  barcodeValue?: string | null;
  /** Bounding box for the live barcode, in preview coordinates (px). */
  barcodeBox?: { x: number; y: number; width: number; height: number } | null;
}

const ACCENT = '#818cf8';
const LOCK = '#34c759';
const WARN = '#f59e0b';

/**
 * Map a normalised box in still-photo space onto the preview, which shows a
 * centre-cropped (cover) region of that photo.
 */
function mapBox(
  box: DetectionBox,
  viewW: number,
  viewH: number,
  sourceAspect?: number
) {
  if (!sourceAspect || !viewW || !viewH) {
    return { left: box.x * viewW, top: box.y * viewH, width: box.width * viewW, height: box.height * viewH };
  }
  // Work in arbitrary source units, then cover-fit them into the view.
  const srcW = 1000;
  const srcH = srcW / sourceAspect;
  const scale = Math.max(viewW / srcW, viewH / srcH);
  const offsetX = (srcW * scale - viewW) / 2;
  const offsetY = (srcH * scale - viewH) / 2;
  return {
    left: box.x * srcW * scale - offsetX,
    top: box.y * srcH * scale - offsetY,
    width: box.width * srcW * scale,
    height: box.height * srcH * scale,
  };
}

export default function ScannerOverlay({
  mode,
  detection,
  detecting,
  aiAssist,
  aiSuspended = false,
  sourceAspect,
  barcodeValue,
  barcodeBox,
}: ScannerOverlayProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sweep = useRef(new Animated.Value(0)).current;
  const lockPop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const boxFade = useRef(new Animated.Value(0)).current;

  const locked = !!detection?.found && detection.confidence >= LOCK_CONFIDENCE;
  const lockKey = locked
    ? `${detection!.box.x.toFixed(2)}-${detection!.box.y.toFixed(2)}-${detection!.kind}`
    : 'none';

  // Laser sweep — runs whenever we're actively looking for something.
  const sweeping = mode === 'receipt' ? (aiAssist && !aiSuspended) || detecting : true;
  useEffect(() => {
    if (!sweeping) {
      sweep.stopAnimation();
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweeping, sweep]);

  // Breathing glow on the frame corners.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // "Snap on" whenever the detection moves to a new position.
  useEffect(() => {
    if (!locked) {
      Animated.timing(boxFade, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return;
    }
    lockPop.setValue(0);
    Animated.parallel([
      Animated.timing(boxFade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(lockPop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [lockKey, locked, boxFade, lockPop]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const frame = useMemo(() => {
    // The guide frame is a fraction of the viewport, so it only needs to be
    // recomputed when the mode or the measured size changes.
    const { w, h } = size;
    if (!w || !h) return null;
    if (mode === 'barcode') {
      const width = w * 0.78;
      return { left: (w - width) / 2, top: h * 0.5 - width * 0.28, width, height: width * 0.56 };
    }
    const width = w * 0.8;
    const height = Math.min(h * 0.66, width / 0.62);
    return { left: (w - width) / 2, top: (h - height) / 2 - h * 0.03, width, height };
  }, [mode, size]);

  const mapped =
    locked && size.w ? mapBox(detection!.box, size.w, size.h, sourceAspect) : null;

  const cornerColor = locked ? LOCK : mode === 'barcode' ? WARN : ACCENT;

  const statusText = (() => {
    if (mode === 'barcode') {
      return barcodeValue ? `Barcode: ${barcodeValue}` : 'Point at a barcode';
    }
    if (detecting) return 'AI is looking…';
    if (locked) {
      const q = QUALITY_LABEL[detection!.quality];
      const pct = Math.round(detection!.confidence * 100);
      const kind = detection!.kind === 'invoice' ? 'Invoice' : detection!.kind === 'barcode' ? 'Barcode' : 'Receipt';
      return q && detection!.quality !== 'good' ? `${kind} found — ${q}` : `${kind} locked · ${pct}%`;
    }
    if (aiAssist && aiSuspended) return 'AI paused — tap to resume';
    if (detection && !detection.found) return detection.hint || 'No receipt in frame';
    if (aiAssist) return 'AI assist on — hold over receipt';
    return 'Position receipt in frame';
  })();

  const statusTone = locked
    ? detection!.quality === 'good'
      ? LOCK
      : WARN
    : 'rgba(255,255,255,0.85)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {/* Dimmed surround — makes the guide frame read as a cutout */}
      {frame && (
        <>
          <View style={[styles.dim, { left: 0, top: 0, right: 0, height: frame.top }]} />
          <View
            style={[styles.dim, { left: 0, top: frame.top + frame.height, right: 0, bottom: 0 }]}
          />
          <View
            style={[styles.dim, { left: 0, top: frame.top, width: frame.left, height: frame.height }]}
          />
          <View
            style={[
              styles.dim,
              { left: frame.left + frame.width, top: frame.top, right: 0, height: frame.height },
            ]}
          />
        </>
      )}

      {/* Guide frame: corner brackets, thirds grid, laser sweep */}
      {frame && (
        <View style={[styles.frame, frame]}>
          <View style={[styles.gridLine, { top: '33.33%' }]} />
          <View style={[styles.gridLine, { top: '66.66%' }]} />
          <View style={[styles.gridLineV, { left: '33.33%' }]} />
          <View style={[styles.gridLineV, { left: '66.66%' }]} />

          {sweeping && (
            <Animated.View
              style={[
                styles.sweepWrap,
                {
                  transform: [
                    {
                      translateY: sweep.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max(0, frame.height - 4)],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(129,140,248,0)', 'rgba(129,140,248,0.35)', 'rgba(129,140,248,0)']}
                style={styles.sweepGlow}
              />
              <View style={styles.sweepLine} />
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.cornerWrap,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) },
            ]}
          >
            <View style={[styles.corner, styles.tl, { borderColor: cornerColor }]} />
            <View style={[styles.corner, styles.tr, { borderColor: cornerColor }]} />
            <View style={[styles.corner, styles.bl, { borderColor: cornerColor }]} />
            <View style={[styles.corner, styles.br, { borderColor: cornerColor }]} />
          </Animated.View>
        </View>
      )}

      {/* AI lock-on box, mapped from the still-frame coordinates */}
      {mapped && (
        <Animated.View
          style={[
            styles.lockBox,
            {
              left: mapped.left,
              top: mapped.top,
              width: mapped.width,
              height: mapped.height,
              opacity: boxFade,
              transform: [
                { scale: lockPop.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.lockInner} />
          <View style={styles.lockTag}>
            <MaterialCommunityIcons name="check-decagram" size={12} color="#000" />
            <Text style={styles.lockTagText}>
              {(detection!.kind === 'barcode' ? 'BARCODE' : 'RECEIPT') +
                ' ' +
                Math.round(detection!.confidence * 100) +
                '%'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Live barcode box (from the camera's own scanner, already in px) */}
      {mode === 'barcode' && barcodeBox && (
        <View
          style={[
            styles.barcodeBox,
            {
              left: barcodeBox.x,
              top: barcodeBox.y,
              width: barcodeBox.width,
              height: barcodeBox.height,
            },
          ]}
        />
      )}

      {/* Status chip */}
      {frame && (
        <View style={[styles.statusWrap, { top: frame.top + frame.height + 16 }]}>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const CORNER = 30;
const CW = 3;

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)' },
  frame: { position: 'absolute', overflow: 'hidden', borderRadius: 4 },
  cornerWrap: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderRadius: 3 },
  tl: { top: 0, left: 0, borderTopWidth: CW, borderLeftWidth: CW },
  tr: { top: 0, right: 0, borderTopWidth: CW, borderRightWidth: CW },
  bl: { bottom: 0, left: 0, borderBottomWidth: CW, borderLeftWidth: CW },
  br: { bottom: 0, right: 0, borderBottomWidth: CW, borderRightWidth: CW },

  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  sweepWrap: { position: 'absolute', left: 0, right: 0, top: 0 },
  sweepGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  sweepLine: {
    height: 2,
    backgroundColor: 'rgba(199,205,255,0.95)',
    shadowColor: ACCENT,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  lockBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: LOCK,
    borderRadius: 8,
    shadowColor: LOCK,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  lockInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6,
    backgroundColor: 'rgba(52,199,89,0.10)',
  },
  lockTag: {
    position: 'absolute',
    top: -13,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: LOCK,
  },
  lockTagText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  barcodeBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: WARN,
    borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },

  statusWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: 'white', fontSize: 13, fontWeight: '600', flexShrink: 1 },
});

import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * The frozen-frame confirmation step.
 *
 * This is the fix for the loudest complaint about competing barcode scanners:
 * they act on the first code they decode, before the user has finished aiming.
 * On a parcel carrying a courier label, a returns label and a product barcode,
 * "first one seen" is reliably the wrong one.
 *
 * It also fixes the second complaint — blurry captures — for free, because the
 * still we freeze on is taken through the full camera pipeline rather than
 * being a live analysis frame, so it re-decodes more reliably than the preview.
 *
 * Why a still and not the live callback: expo-camera's Android analyzer takes
 * `barcodes.first()` and discards the rest of the frame's results before they
 * reach JavaScript, so the live callback structurally cannot report that there
 * are three barcodes in shot. `scanFromURLAsync` on the captured still returns
 * all of them.
 */

export interface DetectedCode {
  data: string;
  type: string;
  /** Bounding box in the captured image's pixel coordinates. */
  box: { x: number; y: number; width: number; height: number } | null;
}

export interface FrozenFrame {
  uri: string;
  width: number;
  height: number;
  codes: DetectedCode[];
}

interface Props {
  frame: FrozenFrame;
  viewWidth: number;
  viewHeight: number;
  onPick: (code: DetectedCode) => void;
  onCancel: () => void;
}

/**
 * Map a box from captured-image pixels onto the preview.
 *
 * The frozen still is displayed with `resizeMode="cover"`, matching how the
 * camera preview crops the sensor, so the same centre-crop maths applies:
 * scale to cover, then subtract the overflow that fell off each edge.
 */
function mapBox(
  box: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number
) {
  if (!imgW || !imgH || !viewW || !viewH) return null;
  const scale = Math.max(viewW / imgW, viewH / imgH);
  const dx = (imgW * scale - viewW) / 2;
  const dy = (imgH * scale - viewH) / 2;
  return {
    left: box.x * scale - dx,
    top: box.y * scale - dy,
    width: box.width * scale,
    height: box.height * scale,
  };
}

export default function BarcodePicker({
  frame,
  viewWidth,
  viewHeight,
  onPick,
  onCancel,
}: Props) {
  const multiple = frame.codes.length > 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: frame.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      {frame.codes.map((code, i) => {
        const mapped = code.box
          ? mapBox(code.box, frame.width, frame.height, viewWidth, viewHeight)
          : null;
        if (!mapped) return null;

        // A tight barcode box is a hard tap target, so pad it out to something
        // a thumb can actually hit without moving the highlight itself.
        const padX = Math.max(0, (64 - mapped.width) / 2);
        const padY = Math.max(0, (64 - mapped.height) / 2);

        return (
          <TouchableOpacity
            key={`${code.data}-${i}`}
            style={{
              position: 'absolute',
              left: mapped.left - padX,
              top: mapped.top - padY,
              width: mapped.width + padX * 2,
              height: mapped.height + padY * 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => onPick(code)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.box,
                { width: mapped.width, height: mapped.height },
                multiple && styles.boxMulti,
              ]}
            >
              {multiple && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{i + 1}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Prompt + actions */}
      <View style={styles.panel}>
        <Text style={styles.title}>
          {multiple
            ? `${frame.codes.length} barcodes in shot`
            : frame.codes.length === 1
              ? 'Scan this one?'
              : 'No barcode found'}
        </Text>
        <Text style={styles.subtitle}>
          {multiple
            ? 'Tap the one you want.'
            : frame.codes.length === 1
              ? frame.codes[0].data
              : 'Nothing decoded on that frame. Try again, a little closer.'}
        </Text>

        {frame.codes.length === 1 && (
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onPick(frame.codes[0])}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="check" size={18} color="#000" />
            <Text style={styles.confirmText}>Scan this</Text>
          </TouchableOpacity>
        )}

        {multiple && (
          <View style={styles.codeList}>
            {frame.codes.map((code, i) => (
              <TouchableOpacity
                key={`row-${code.data}-${i}`}
                style={styles.codeRow}
                onPress={() => onPick(code)}
                activeOpacity={0.7}
              >
                <View style={styles.rowBadge}>
                  <Text style={styles.rowBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.codeText} numberOfLines={1}>
                  {code.data}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>
            {frame.codes.length === 0 ? 'Try again' : 'Not that — keep looking'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.35)' },

  box: {
    borderWidth: 2.5,
    borderColor: '#34c759',
    borderRadius: 6,
    backgroundColor: 'rgba(52,199,89,0.16)',
  },
  boxMulti: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.18)' },
  badge: {
    position: 'absolute',
    top: -11,
    left: -11,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#000', fontSize: 12, fontWeight: '900' },

  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(18,18,20,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  title: { color: 'white', fontSize: 17, fontWeight: '700' },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.4,
  },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    minHeight: 50,
    marginTop: 14,
  },
  confirmText: { color: '#000', fontSize: 15, fontWeight: '700' },

  codeList: { marginTop: 12, gap: 6 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBadgeText: { color: '#000', fontSize: 11, fontWeight: '900' },
  codeText: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },

  cancelBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4 },
  cancelText: { color: 'rgba(255,255,255,0.65)', fontSize: 13.5 },
});

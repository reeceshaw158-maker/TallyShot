/**
 * SkeletonPulse — animated placeholder block that pulses between
 * 40% and 100% opacity on a 700 ms loop.
 *
 * Usage: drop it in wherever a real piece of content will load,
 * sized to roughly match the content it replaces.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface Props {
  style: StyleProp<ViewStyle>;
}

export function SkeletonPulse({ style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
}

/**
 * SpringButton — a drop-in replacement for TouchableOpacity that adds
 * a Material 3 Expressive spring-scale press effect.
 *
 * On press-in the button scales to 0.96; on press-out it springs back
 * with stiffness=300 / damping=20, giving a satisfying elastic snap.
 * Works on both Android and iOS.
 */
import { useCallback } from 'react';
import { StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

interface SpringButtonProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
  hitSlop?: number;
  activeOpacity?: number; // accepted but ignored — opacity is not used here
}

const SPRING_CONFIG = { stiffness: 300, damping: 20 };

export function SpringButton({
  onPress,
  onLongPress,
  style,
  children,
  disabled,
  hitSlop,
}: SpringButtonProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, SPRING_CONFIG);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      disabled={disabled}
    >
      <Animated.View style={[animStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

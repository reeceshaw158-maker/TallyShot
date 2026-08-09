import { useEffect, useRef } from 'react';
import { Animated, Text, StyleProp, TextStyle } from 'react-native';

interface Props {
  value: number;
  formatter: (n: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

export function AnimatedNumber({ value, formatter, style, duration = 900 }: Props) {
  const animated = useRef(new Animated.Value(0)).current;
  const displayRef = useRef(0);
  const textRef = useRef<Text>(null);

  useEffect(() => {
    Animated.timing(animated, {
      toValue: value,
      duration,
      useNativeDriver: false, // must be false to interpolate numeric values
    }).start();

    const id = animated.addListener(({ value: v }) => {
      displayRef.current = v;
      // @ts-ignore — setNativeProps is valid on Text for performance
      textRef.current?.setNativeProps({ text: formatter(v) });
    });

    return () => animated.removeListener(id);
  }, [value]);

  return (
    <Text ref={textRef} style={style}>
      {formatter(0)}
    </Text>
  );
}

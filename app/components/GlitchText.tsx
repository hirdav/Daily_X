import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

interface GlitchTextProps {
  children: string;
}

const GlitchText: React.FC<GlitchTextProps> = ({ children }) => {
  const glitchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glitchAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(glitchAnim, {
          toValue: -1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(glitchAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const animatedStyle1 = {
    transform: [{ translateX: glitchAnim }],
    color: 'white',
    position: 'absolute' as const,
  };

  const animatedStyle2 = {
    transform: [{ translateX: Animated.multiply(glitchAnim, -1) }],
    color: 'maroon',
    position: 'absolute' as const,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.base}>{children}</Text>
      <Animated.Text style={[styles.base, animatedStyle1]}>{children}</Animated.Text>
      <Animated.Text style={[styles.base, animatedStyle2]}>{children}</Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  base: {
    fontSize: 40,
    fontWeight: 'bold',
    textTransform: 'lowercase',
    textAlign: 'center',
    color: 'white',
  },
});

export default GlitchText;



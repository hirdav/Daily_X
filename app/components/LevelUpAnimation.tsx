import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Colors, Typography } from '../styles/global';

interface LevelUpAnimationProps {
  visible: boolean;
  level: number;
  onAnimationEnd?: () => void;
}

const LevelUpAnimation: React.FC<LevelUpAnimationProps> = ({ visible, level, onAnimationEnd }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }).start(() => onAnimationEnd && onAnimationEnd());
        }, 900);
      });
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.text}>Level Up!</Text>
        <Text style={styles.level}>Level {level}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: Colors.primary + 'F0',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 40,
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.17,
    shadowRadius: 12,
  },
  text: {
    ...Typography.heading,
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 26,
    marginBottom: 4,
  },
  level: {
    ...Typography.body,
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default LevelUpAnimation;

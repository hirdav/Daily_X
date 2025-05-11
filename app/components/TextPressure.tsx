import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

interface TextPressureProps {
  text: string;
  textColor?: string;
  strokeColor?: string;
  minFontSize?: number;
  weight?: boolean;
  italic?: boolean;
}

const TextPressure: React.FC<TextPressureProps> = ({
  text,
  textColor = '#fff',
  strokeColor = '#ff0000',
  minFontSize = 36,
  weight = false,
  italic = false,
}) => {
  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: minFontSize,
            fontWeight: weight ? '800' : '400',
            fontStyle: italic ? 'italic' : 'normal',
            textShadowColor: strokeColor,
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 1,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

export default TextPressure;

const styles = StyleSheet.create({
  container: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    letterSpacing: 1,
  },
});


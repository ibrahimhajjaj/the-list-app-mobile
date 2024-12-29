import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Keyboard } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export default function OTPInput({ 
  length = 8,
  value = '',
  onChange,
  autoFocus = true
}: OTPInputProps) {
  const colors = useThemeColors();
  const inputRefs = useRef<TextInput[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  const handleChange = (text: string, index: number) => {
    const newValue = value.split('');
    newValue[index] = text.toUpperCase();
    const finalValue = newValue.join('');
    onChange(finalValue);

    // Move to next input if there's a value
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      // Move to previous input on backspace if current input is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(-1);
  };

  return (
    <View style={styles.container}>
      {Array(length).fill(0).map((_, index) => (
        <TextInput
          key={index}
          ref={ref => {
            if (ref) inputRefs.current[index] = ref;
          }}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: value[index] 
                ? colors.success 
                : focusedIndex === index 
                  ? colors.primary 
                  : colors.border,
              color: colors.foreground,
            },
          ]}
          maxLength={1}
          value={value[index] || ''}
          onChangeText={text => handleChange(text, index)}
          onKeyPress={e => handleKeyPress(e, index)}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
          keyboardType="ascii-capable"
          autoCapitalize="characters"
          autoFocus={autoFocus && index === 0}
          selectTextOnFocus
          returnKeyType={index === length - 1 ? 'done' : 'next'}
          onSubmitEditing={() => {
            if (index === length - 1) {
              Keyboard.dismiss();
            } else {
              inputRefs.current[index + 1]?.focus();
            }
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.s,
  },
  input: {
    width: 40,
    height: 48,
    borderWidth: 2,
    borderRadius: theme.borderRadius.m,
    fontSize: theme.typography.fontSize.h3,
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.bold,
  },
}); 
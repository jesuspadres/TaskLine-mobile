import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { FontSizes } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  color?: string;
}

const sizes = {
  sm: 32,
  md: 40,
  lg: 50,
  xl: 80,
};

const fontSizes = {
  sm: FontSizes.sm,
  md: FontSizes.md,
  lg: FontSizes.xl,
  xl: FontSizes['3xl'],
};

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  style,
  imageStyle,
  color,
}: AvatarProps) {
  const { colors } = useTheme();
  const dimension = sizes[size];
  const fontSize = fontSizes[size];
  const bgColor = color ?? colors.primary;

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            backgroundColor: colors.surfaceSecondary,
          },
          imageStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  image: {},
});

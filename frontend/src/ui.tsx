import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from './theme';

/** Fixed pastel aurora background used on all main screens */
export function AuroraBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#F4F7FC', '#F4F7FC']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, { top: -120, left: -80, backgroundColor: '#E5DBFF' }]} />
      <View style={[styles.blob, { top: 200, right: -100, backgroundColor: '#D0F0FD' }]} />
      <View style={[styles.blob, { bottom: -100, left: 40, backgroundColor: '#E2F9EE' }]} />
      <View style={[styles.blob, { bottom: 200, right: -60, backgroundColor: '#FDE6F4', opacity: 0.6 }]} />
    </View>
  );
}

type GlassProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  padded?: boolean;
  radius?: number;
};

export function GlassCard({ children, style, intensity = 40, padded = true, radius: r = 24 }: GlassProps) {
  const inner = (
    <View style={[padded && { padding: spacing.lg }]}>
      {children}
    </View>
  );
  if (Platform.OS === 'android') {
    // BlurView on some low-end Androids is heavy; use translucent white fallback
    return (
      <View style={[styles.glassFallback, { borderRadius: r }, style]}>
        {inner}
      </View>
    );
  }
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.glass, { borderRadius: r }, style]}>
      <View style={[styles.glassTint, { borderRadius: r }]} />
      {inner}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    opacity: 0.5,
  },
  glass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  glassFallback: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
});

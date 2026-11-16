import React, { useMemo, useRef } from 'react';
import { PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { useAppStore } from '../../store/useAppStore';

interface PinchZoomWrapperProps {
  children: React.ReactNode;
}

function getTouchDistance(touches: ReadonlyArray<{ pageX: number; pageY: number }>): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

/**
 * Two-finger pinch-to-zoom gesture controller for text magnification.
 * Scales typography cleanly so Flexbox reflows without deforming cards or layouts.
 * Single-finger taps and scrolling pass straight through untouched.
 */
export const PinchZoomWrapper: React.FC<PinchZoomWrapperProps> = ({ children }) => {
  const uiTextScale = useAppStore((s) => s.uiTextScale);
  const setUiTextScale = useAppStore((s) => s.setUiTextScale);

  const startDistRef = useRef<number>(0);
  const startScaleRef = useRef<number>(1);
  const currentScaleRef = useRef<number>(uiTextScale);
  currentScaleRef.current = uiTextScale;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
        onPanResponderTerminationRequest: (evt) => evt.nativeEvent.touches.length < 2,
        onPanResponderGrant: (evt) => {
          const dist = getTouchDistance(evt.nativeEvent.touches);
          if (dist > 0) {
            startDistRef.current = dist;
            startScaleRef.current = currentScaleRef.current;
          }
        },
        onPanResponderMove: (evt) => {
          if (evt.nativeEvent.touches.length !== 2) return;
          const dist = getTouchDistance(evt.nativeEvent.touches);
          if (startDistRef.current <= 0) {
            startDistRef.current = dist;
            startScaleRef.current = currentScaleRef.current;
            return;
          }
          const raw = startScaleRef.current * (dist / startDistRef.current);
          const stepped = Math.round(raw * 20) / 20;
          if (Math.abs(stepped - currentScaleRef.current) >= 0.05) {
            setUiTextScale(stepped);
          }
        },
        onPanResponderRelease: () => {
          startDistRef.current = 0;
        },
        onPanResponderTerminate: () => {
          startDistRef.current = 0;
        },
      }),
    [setUiTextScale]
  );

  const scale = uiTextScale || 1;
  const isZoomed = Math.abs(scale - 1) > 0.01;

  return (
    <View style={{ flex: 1, width: '100%' }} {...panResponder.panHandlers}>
      {children}

      {isZoomed && (
        <View
          style={{
            position: 'absolute',
            right: 14,
            bottom: 92,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            zIndex: 999,
          }}
        >
          <TouchableOpacity onPress={() => setUiTextScale(scale - 0.1)} hitSlop={8}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUiTextScale(1)} hitSlop={8}>
            <Text style={{ color: '#5EEAD4', fontSize: 11, fontWeight: '800' }}>
              {Math.round(scale * 100)}% • Reset
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUiTextScale(scale + 0.1)} hitSlop={8}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>A+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

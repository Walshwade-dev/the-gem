import React from 'react';
import { StyleSheet, TextProps } from 'react-native';
import { useAppStore } from '../store/useAppStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require('react-native') as Record<string, unknown>;
const OriginalText = RN.Text as React.ComponentType<TextProps & { ref?: React.Ref<unknown> }>;

if (OriginalText && !(OriginalText as { __gemZoomWrapped?: boolean }).__gemZoomWrapped) {
  const ZoomableText = React.forwardRef<unknown, TextProps>((props, ref) => {
    const scale = useAppStore((s) => s.uiTextScale);

    if (!scale || Math.abs(scale - 1) < 0.01) {
      return React.createElement(OriginalText, { ...props, ref });
    }

    const flat = StyleSheet.flatten(props.style) as
      | { fontSize?: number; lineHeight?: number }
      | undefined;
    const baseFontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : 14;
    const scaledStyle: { fontSize: number; lineHeight?: number } = {
      fontSize: Math.round(baseFontSize * scale * 10) / 10,
    };
    if (typeof flat?.lineHeight === 'number') {
      scaledStyle.lineHeight = Math.round(flat.lineHeight * scale * 10) / 10;
    }

    return React.createElement(OriginalText, {
      ...props,
      ref,
      style: [props.style, scaledStyle],
    });
  });

  ZoomableText.displayName = 'Text';
  (ZoomableText as unknown as { __gemZoomWrapped: boolean }).__gemZoomWrapped = true;

  Object.defineProperty(RN, 'Text', {
    configurable: true,
    enumerable: true,
    get: () => ZoomableText,
  });
}

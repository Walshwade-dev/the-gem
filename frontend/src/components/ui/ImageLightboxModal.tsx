import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface LightboxImageItem {
  uri: string;
  label?: string;
}

interface ImageLightboxModalProps {
  visible: boolean;
  images: LightboxImageItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(1);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 });
  const zoomScaleRef = useRef(1);

  useEffect(() => {
    if (visible) {
      const clamped = Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)));
      setCurrentIndex(clamped);
      setZoomScale(1);
      zoomScaleRef.current = 1;
      pan.setValue({ x: 0, y: 0 });
      panOffset.current = { x: 0, y: 0 };
    }
  }, [visible, initialIndex, images.length, pan]);

  const resetPan = () => {
    pan.setValue({ x: 0, y: 0 });
    panOffset.current = { x: 0, y: 0 };
  };

  const applyZoom = (nextScale: number) => {
    setZoomScale(nextScale);
    zoomScaleRef.current = nextScale;
    if (nextScale <= 1) {
      resetPan();
    }
  };

  const goToIndex = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= images.length) return;
    setCurrentIndex(nextIdx);
    applyZoom(1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (zoomScaleRef.current > 1) {
          pan.setValue({ x: gesture.dx, y: gesture.dy });
        } else {
          pan.setValue({ x: gesture.dx * 0.4, y: 0 });
        }
      },
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        if (zoomScaleRef.current > 1) {
          const { width, height } = Dimensions.get('window');
          const maxX = ((zoomScaleRef.current - 1) * width) / 2;
          const maxY = ((zoomScaleRef.current - 1) * height) / 2;
          const nextX = Math.max(-maxX, Math.min(maxX, panOffset.current.x + gesture.dx));
          const nextY = Math.max(-maxY, Math.min(maxY, panOffset.current.y + gesture.dy));
          panOffset.current = { x: nextX, y: nextY };
          Animated.spring(pan, {
            toValue: { x: nextX, y: nextY },
            useNativeDriver: false,
            friction: 7,
          }).start();
        } else {
          // Horizontal swipe to switch images when not zoomed
          if (gesture.dx < -50 && currentIndex < images.length - 1) {
            goToIndex(currentIndex + 1);
          } else if (gesture.dx > 50 && currentIndex > 0) {
            goToIndex(currentIndex - 1);
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              friction: 7,
            }).start();
            panOffset.current = { x: 0, y: 0 };
          }
        }
      },
    })
  ).current;

  if (!visible || images.length === 0) return null;

  const activeItem = images[currentIndex] || images[0];
  const { width, height } = Dimensions.get('window');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Top Overlay Controls */}
        <View style={styles.topBar}>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
              {activeItem.label ? ` • ${activeItem.label}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Expandable & Pannable Image Area */}
        <View style={styles.imageStage} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.animatedImageWrap,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { scale: zoomScale },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: activeItem.uri }}
              style={{ width: width - 16, height: height * 0.72 }}
              resizeMode="contain"
            />
          </Animated.View>

          {images.length > 1 && currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowLeft]}
              onPress={() => goToIndex(currentIndex - 1)}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {images.length > 1 && currentIndex < images.length - 1 && (
            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowRight]}
              onPress={() => goToIndex(currentIndex + 1)}
            >
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Zoom & Pan Helper Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.zoomBtn, zoomScale === 1 && styles.zoomBtnActive]}
            onPress={() => applyZoom(1)}
          >
            <Text style={styles.zoomBtnText}>1x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomBtn, zoomScale === 2 && styles.zoomBtnActive]}
            onPress={() => applyZoom(2)}
          >
            <Text style={styles.zoomBtnText}>2x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomBtn, zoomScale === 3 && styles.zoomBtnActive]}
            onPress={() => applyZoom(3)}
          >
            <Text style={styles.zoomBtnText}>3x</Text>
          </TouchableOpacity>
          <Text style={styles.hintText}>
            {zoomScale > 1 ? 'Drag to move around' : images.length > 1 ? 'Swipe or tap arrows' : 'Tap 2x/3x to zoom & pan'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 10,
    zIndex: 10,
  },
  counterPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  animatedImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    position: 'absolute',
    top: '46%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: {
    left: 12,
  },
  navArrowRight: {
    right: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 10,
  },
  zoomBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  zoomBtnActive: {
    backgroundColor: '#0891B2',
    borderColor: '#38BDF8',
  },
  zoomBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  hintText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
});

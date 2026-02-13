import { useRef, useState, useCallback, useMemo } from 'react';
import { Animated, LayoutChangeEvent, ViewStyle } from 'react-native';

/**
 * Hook that smoothly hides a filter area as the user scrolls down,
 * and reveals it again when scrolling back up. The animation follows
 * the scroll position 1:1 (no timed snap).
 *
 * The filter container is absolutely positioned so that hiding it
 * does NOT push/pull the content below it.
 *
 * Usage:
 *   const { filterContainerStyle, onFilterLayout, onScroll, filterHeight } = useCollapsibleFilters();
 *
 *   <View style={{ flex: 1, overflow: 'hidden' }}>
 *     <Animated.View
 *       style={[filterContainerStyle, { backgroundColor: colors.background }]}
 *       onLayout={onFilterLayout}
 *     >
 *       ...filters...
 *     </Animated.View>
 *     <FlatList
 *       onScroll={onScroll}
 *       scrollEventThrottle={16}
 *       contentContainerStyle={{ paddingTop: filterHeight }}
 *     />
 *   </View>
 */
export function useCollapsibleFilters() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [filterHeight, setFilterHeight] = useState(0);

  const { translateY } = useMemo(() => {
    const h = filterHeight || 1;
    // Clamp negative scroll values (overscroll/bounce at top) to 0 so that
    // diffClamp doesn't interpret the bounce-back as a "scroll down".
    const nonNegativeScroll = scrollY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolateLeft: 'clamp',
      extrapolateRight: 'identity',
    });
    const clamp = Animated.diffClamp(nonNegativeScroll, 0, h);
    const ty = clamp.interpolate({
      inputRange: [0, h],
      outputRange: [0, -h],
    });
    return { translateY: ty };
  }, [scrollY, filterHeight]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const onFilterLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setFilterHeight(prev => (prev === h ? prev : h));
  }, []);

  const filterContainerStyle = {
    transform: [{ translateY }],
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  };

  return { filterContainerStyle, onFilterLayout, onScroll, filterHeight };
}

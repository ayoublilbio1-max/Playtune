import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    scrollTo,
    useAnimatedReaction,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    type AnimatedRef,
    type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "../hooks/use-theme";

type Props<T> = {
  data: T[];
  keyOf: (item: T, index: number) => string;
  rowHeight: number;
  /** Row content (the drag handle ≡ is added on the right). */
  renderItem: (item: T, index: number) => ReactNode;
  /** Called once when a row is dropped at a new place. */
  onMove: (from: number, to: number) => void;
  header?: ReactNode;
  footerSpace?: number;
};

type Positions = Record<string, number>;

const EDGE = 60;
const AUTO_SCROLL_STEP = 14;

function haptic() {
  Haptics.selectionAsync().catch(() => {});
}

function Row({
  id,
  rowHeight,
  count,
  positions,
  scrollY,
  viewportHeight,
  headerHeight,
  scrollRef,
  onDrop,
  children,
}: {
  id: string;
  rowHeight: number;
  count: number;
  positions: SharedValue<Positions>;
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  headerHeight: SharedValue<number>;
  scrollRef: AnimatedRef<Animated.ScrollView>;
  onDrop: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const colors = useTheme();
  const active = useSharedValue(false);
  const top = useSharedValue((positions.get()[id] ?? 0) * rowHeight);
  const startTop = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const startIndex = useSharedValue(0);

  // Follow position changes made by other rows (or by a new list from the app).
  useAnimatedReaction(
    () => positions.get()[id] ?? 0,
    (index, previous) => {
      if (index !== previous && !active.get())
        top.set(withSpring(index * rowHeight, { damping: 22, stiffness: 260 }));
    },
    [id, rowHeight],
  );

  const style = useAnimatedStyle(() => {
    return {
      top: top.get(),
      zIndex: active.get() ? 10 : 0,
      shadowOpacity: withTiming(active.get() ? 0.3 : 0),
      elevation: active.get() ? 8 : 0,
      transform: [
        { scale: withTiming(active.get() ? 1.02 : 1, { duration: 120 }) },
      ],
    };
  });

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          "worklet";
          active.set(true);
          startTop.set(top.get());
          startScroll.set(scrollY.get());
          startIndex.set(positions.get()[id] ?? 0);
          scheduleOnRN(haptic);
        })
        .onUpdate((e) => {
          "worklet";
          const y =
            startTop.get() +
            e.translationY +
            (scrollY.get() - startScroll.get());
          const maxTop = (count - 1) * rowHeight;
          const clamped = Math.min(maxTop, Math.max(0, y));
          top.set(clamped);

          // Swap with the row we moved onto.
          const newIndex = Math.round(clamped / rowHeight);
          const current = positions.get();
          const oldIndex = current[id];
          if (newIndex !== oldIndex) {
            const next: Positions = {};
            for (const key in current) {
              const p = current[key];
              if (key === id) next[key] = newIndex;
              else if (oldIndex < newIndex && p > oldIndex && p <= newIndex)
                next[key] = p - 1;
              else if (oldIndex > newIndex && p >= newIndex && p < oldIndex)
                next[key] = p + 1;
              else next[key] = p;
            }
            positions.set(next);
            scheduleOnRN(haptic);
          }

          // Scroll when the row is dragged near the top or bottom edge.
          const inView = clamped + headerHeight.get() - scrollY.get();
          if (inView < EDGE && scrollY.get() > 0) {
            scrollTo(
              scrollRef,
              0,
              Math.max(0, scrollY.get() - AUTO_SCROLL_STEP),
              false,
            );
          } else if (inView > viewportHeight.get() - rowHeight - EDGE) {
            scrollTo(scrollRef, 0, scrollY.get() + AUTO_SCROLL_STEP, false);
          }
        })
        .onFinalize(() => {
          "worklet";
          if (!active.get()) return;
          active.set(false);
          const to = positions.get()[id] ?? 0;
          top.set(withSpring(to * rowHeight, { damping: 22, stiffness: 260 }));
          if (to !== startIndex.get())
            scheduleOnRN(onDrop, startIndex.get(), to);
        }),
    [
      id,
      rowHeight,
      count,
      positions,
      scrollY,
      viewportHeight,
      headerHeight,
      scrollRef,
      onDrop,
      active,
      top,
      startTop,
      startScroll,
      startIndex,
    ],
  );

  return (
    <Animated.View
      style={[
        styles.row,
        {
          height: rowHeight,
          backgroundColor: colors.background,
          shadowColor: colors.accent,
        },
        style,
      ]}
    >
      <View style={styles.content}>{children}</View>
      <GestureDetector gesture={gesture}>
        <View style={styles.handle} hitSlop={6}>
          <MaterialCommunityIcons
            name="drag-horizontal-variant"
            size={24}
            color={colors.textMuted}
          />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * List you can reorder by dragging the ≡ handle. Rows have a fixed height.
 * Meant for "reorder mode" screens (Queue, playlist): every row is drawn, so keep it for lists of a few hundred.
 */
export function DraggableList<T>({
  data,
  keyOf,
  rowHeight,
  renderItem,
  onMove,
  header,
  footerSpace = 32,
}: Props<T>) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const headerHeight = useSharedValue(0);
  const keys = data.map((item, i) => keyOf(item, i));
  const keysJoined = keys.join("|");
  const positions = useSharedValue<Positions>(
    Object.fromEntries(keys.map((k, i) => [k, i])),
  );

  // A new order from the app (after a move was saved, or the list changed).
  useEffect(() => {
    const list = keysJoined ? keysJoined.split("|") : [];
    positions.set(Object.fromEntries(list.map((k, i) => [k, i])));
  }, [keysJoined, positions]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(e) => viewportHeight.set(e.nativeEvent.layout.height)}
      contentContainerStyle={{ paddingBottom: footerSpace }}
    >
      <View onLayout={(e) => headerHeight.set(e.nativeEvent.layout.height)}>
        {header}
      </View>
      <View style={{ height: data.length * rowHeight }}>
        {data.map((item, index) => (
          <Row
            key={keys[index]}
            id={keys[index]}
            rowHeight={rowHeight}
            count={data.length}
            positions={positions}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            headerHeight={headerHeight}
            scrollRef={scrollRef}
            onDrop={onMove}
          >
            {renderItem(item, index)}
          </Row>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  content: {
    flex: 1,
  },
  handle: {
    width: 52,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});

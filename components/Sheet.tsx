import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type NativeGesture,
  type PanGesture,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  SHEET_CORNER_RADIUS,
  useSheetMetrics,
  type SheetProps,
  type SheetRouteFrameProps,
  type SheetSize,
} from "@/components/sheetLayout";

export { SHEET_CORNER_RADIUS } from "@/components/sheetLayout";
export type { SheetProps, SheetRouteFrameProps, SheetSize } from "@/components/sheetLayout";

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
const OPEN_TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: 220, easing: Easing.in(Easing.quad) };
const SETTLE_SPRING = { damping: 30, stiffness: 320, overshootClamping: true };

type SheetGestureState = {
  scrollGesture: NativeGesture;
  scrollY: SharedValue<number>;
  touchingScroll: SharedValue<boolean>;
  translateY: SharedValue<number>;
  /** Set when only the grabber and SheetDragHandle regions drag the sheet. */
  handlePan: PanGesture | null;
};

const SheetGestureContext = createContext<SheetGestureState | null>(null);
const SheetDismissContext = createContext<(() => void) | null>(null);

/** Close action for buttons inside a sheet: animates the sheet out before `fallback` runs. */
export function useSheetDismiss(fallback: () => void) {
  return useContext(SheetDismissContext) ?? fallback;
}

/**
 * Scroll view that hands a downward drag to the sheet once its content is at the top,
 * so a sheet closes the same way a native iOS sheet does.
 */
export const SheetScrollView = forwardRef<ScrollView, ScrollViewProps>(function SheetScrollView(
  { onScroll, scrollEventThrottle, ...props },
  forwardedRef,
) {
  const sheet = useContext(SheetGestureContext);
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(forwardedRef, () => scrollRef.current as ScrollView);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (sheet) {
        const y = event.nativeEvent.contentOffset.y;
        sheet.scrollY.value = y;
        // While the sheet is being dragged down, keep the content pinned to the top.
        if (sheet.translateY.value > 0 && y > 0) {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        }
      }
      onScroll?.(event);
    },
    [onScroll, sheet],
  );

  const scrollView = (
    <ScrollView
      ref={scrollRef}
      {...props}
      bounces={sheet ? false : props.bounces}
      overScrollMode={sheet ? "never" : props.overScrollMode}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle ?? 16}
    />
  );

  return sheet ? <GestureDetector gesture={sheet.scrollGesture}>{scrollView}</GestureDetector> : scrollView;
});

/** Region that drags the sheet when its content handles its own scrolling (for example a WebView). */
export function SheetDragHandle({ children }: { children: ReactNode }) {
  const sheet = useContext(SheetGestureContext);
  if (!sheet?.handlePan) return <>{children}</>;
  return (
    <GestureDetector gesture={sheet.handlePan}>
      <View>{children}</View>
    </GestureDetector>
  );
}

function SheetGrabber({ closeLabel, onClose }: { closeLabel?: string; onClose: () => void }) {
  if (!closeLabel) {
    return (
      <View className="items-center pb-1.5 pt-2" accessible={false} importantForAccessibility="no-hide-descendants">
        <View className="h-[5px] w-10 rounded-full bg-white/25" />
      </View>
    );
  }
  // The close button shares the grabber row so the sheet spends no extra height on a header.
  return (
    <View className="h-11 flex-row items-center justify-center">
      <View className="h-[5px] w-10 rounded-full bg-white/25" accessible={false} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        hitSlop={8}
        className="absolute right-3 h-8 w-8 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
      >
        <Ionicons name="close" size={18} color="#e4e4e7" />
      </Pressable>
    </View>
  );
}

type SheetBodyProps = {
  children: ReactNode;
  label: string;
  presented: boolean;
  /** Route sheets animate out first, then ask the router to close. */
  closeAfterAnimation: boolean;
  onClose: () => void;
  onHidden?: () => void;
  size: SheetSize;
  dismissible: boolean;
  avoidKeyboard: boolean;
  padBottom: boolean;
  surfaceColor: string;
  contentDraggable: boolean;
  closeLabel?: string;
};

function SheetBody({
  children,
  label,
  presented,
  closeAfterAnimation,
  onClose,
  onHidden,
  size,
  dismissible,
  avoidKeyboard,
  padBottom,
  surfaceColor,
  contentDraggable,
  closeLabel,
}: SheetBodyProps) {
  const { height, insets, topGap } = useSheetMetrics();
  const offscreen = height;
  const translateY = useSharedValue(offscreen);
  const scrollY = useSharedValue(0);
  const touchingScroll = useSharedValue(false);
  const dragAnchor = useSharedValue(0);
  const presentedRef = useRef(presented);
  presentedRef.current = presented;

  const settle = useCallback(() => {
    translateY.value = withSpring(0, SETTLE_SPRING);
  }, [translateY]);

  const hide = useCallback(
    (after?: () => void) => {
      translateY.value = withTiming(offscreen, CLOSE_TIMING, (finished) => {
        if (finished && after) runOnJS(after)();
      });
    },
    [offscreen, translateY],
  );

  useEffect(() => {
    if (presented) {
      translateY.value = withTiming(0, OPEN_TIMING);
    } else {
      hide(onHidden);
    }
  }, [hide, onHidden, presented, translateY]);

  const requestClose = useCallback(() => {
    if (!dismissible) {
      settle();
      return;
    }
    if (closeAfterAnimation) {
      hide(onClose);
      return;
    }
    onClose();
    // A parent that refuses to close (for example while saving) leaves the sheet open.
    setTimeout(() => {
      if (presentedRef.current) settle();
    }, 80);
  }, [closeAfterAnimation, dismissible, hide, onClose, settle]);

  const scrollGesture = useMemo(
    () =>
      Gesture.Native()
        .onBegin(() => {
          touchingScroll.value = true;
        })
        .onFinalize(() => {
          touchingScroll.value = false;
        }),
    [touchingScroll],
  );

  const makePan = useCallback(
    () =>
      Gesture.Pan()
        .enabled(dismissible)
        .activeOffsetY([-8, 8])
        .failOffsetX([-16, 16])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          dragAnchor.value = 0;
        })
        .onUpdate((event) => {
          // Inside scrolled content, the drag scrolls first; the sheet follows once the top is reached.
          if (touchingScroll.value && scrollY.value > 0.5 && translateY.value <= 0) {
            dragAnchor.value = event.translationY;
            return;
          }
          translateY.value = Math.max(0, event.translationY - dragAnchor.value);
        })
        .onEnd((event) => {
          const shouldClose =
            translateY.value > DISMISS_DISTANCE ||
            (translateY.value > 12 && event.velocityY > DISMISS_VELOCITY);
          if (shouldClose) {
            runOnJS(requestClose)();
          } else {
            translateY.value = withSpring(0, SETTLE_SPRING);
          }
        }),
    [dismissible, dragAnchor, requestClose, scrollGesture, scrollY, touchingScroll, translateY],
  );
  // A gesture object attaches to one detector, so the optional drag handle gets its own.
  const pan = useMemo(() => makePan(), [makePan]);
  const handlePan = useMemo(() => makePan(), [makePan]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, offscreen], [1, 0], "clamp"),
  }));

  const gestureState = useMemo(
    () => ({ scrollGesture, scrollY, touchingScroll, translateY, handlePan: contentDraggable ? null : handlePan }),
    [contentDraggable, handlePan, scrollGesture, scrollY, touchingScroll, translateY],
  );

  const surface = (
    <Animated.View
      accessibilityViewIsModal
      accessibilityLabel={label}
      onAccessibilityEscape={requestClose}
      style={[
        styles.surface,
        {
          backgroundColor: surfaceColor,
          flexGrow: size === "tall" ? 1 : 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: padBottom ? insets.bottom : 0,
        },
        sheetStyle,
      ]}
    >
      {contentDraggable ? (
        <SheetGrabber closeLabel={closeLabel} onClose={requestClose} />
      ) : (
        <GestureDetector gesture={pan}>
          <View>
            <SheetGrabber closeLabel={closeLabel} onClose={requestClose} />
          </View>
        </GestureDetector>
      )}
      <SheetDismissContext.Provider value={requestClose}>
        <SheetGestureContext.Provider value={gestureState}>
          <View style={[styles.content, { flexGrow: size === "tall" ? 1 : 0 }]}>{children}</View>
        </SheetGestureContext.Provider>
      </SheetDismissContext.Provider>
    </Animated.View>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          focusable={false}
          onPress={requestClose}
        />
      </Animated.View>
      <KeyboardAvoidingView
        enabled={avoidKeyboard && Platform.OS === "ios"}
        behavior="padding"
        style={styles.fill}
        pointerEvents="box-none"
      >
        <View style={[styles.fill, styles.dock, { paddingTop: topGap }]} pointerEvents="box-none">
          {contentDraggable ? <GestureDetector gesture={pan}>{surface}</GestureDetector> : surface}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** In-screen drawer. Tall sheets cover most of the screen; auto sheets fit their content. */
export function Sheet({
  visible,
  onClose,
  label,
  size = "auto",
  dismissible = true,
  avoidKeyboard = false,
  contentDraggable = true,
  closeLabel,
  onDismiss,
  children,
}: SheetProps) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  const handleHidden = useCallback(() => setMounted(false), []);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
      onDismiss={onDismiss}
    >
      {mounted ? (
        <GestureHandlerRootView style={styles.fill}>
          <SheetBody
            label={label}
            presented={visible}
            closeAfterAnimation={false}
            onClose={onClose}
            onHidden={handleHidden}
            size={size}
            dismissible={dismissible}
            avoidKeyboard={avoidKeyboard}
            padBottom
            surfaceColor="#18181b"
            contentDraggable={contentDraggable}
            closeLabel={closeLabel}
          >
            {children}
          </SheetBody>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

/** Frame for a route presented as a drawer over the page that opened it. */
export function SheetRouteFrame({ children, onClose, label, closeLabel }: SheetRouteFrameProps) {
  return (
    <SheetBody
      label={label}
      presented
      closeAfterAnimation
      onClose={onClose}
      size="tall"
      dismissible
      avoidKeyboard={false}
      padBottom={false}
      surfaceColor="#09090b"
      contentDraggable
      closeLabel={closeLabel}
    >
      {children}
    </SheetBody>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dock: { justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  surface: {
    width: "100%",
    overflow: "hidden",
    flexShrink: 1,
    minHeight: 0,
    borderTopLeftRadius: SHEET_CORNER_RADIUS,
    borderTopRightRadius: SHEET_CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.12)",
  },
  content: { flexShrink: 1, minHeight: 0 },
});

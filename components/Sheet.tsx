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
  BackHandler,
  Keyboard,
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
  SheetDepthContext,
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

  // A remounted list starts at the top, so the sheet must not keep the old offset.
  useEffect(() => {
    if (!sheet) return;
    const { scrollY } = sheet;
    return () => {
      scrollY.value = 0;
    };
  }, [sheet]);

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

function useKeyboardVisible(enabled: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled && visible;
}

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
  const { height, insets, topGap, depth } = useSheetMetrics();
  const keyboardVisible = useKeyboardVisible(avoidKeyboard);
  const offscreen = height;
  const translateY = useSharedValue(offscreen);
  const scrollY = useSharedValue(0);
  const touchingScroll = useSharedValue(false);
  const dragAnchor = useSharedValue(0);
  const closing = useSharedValue(false);
  const isPresented = useSharedValue(presented);
  const presentedRef = useRef(presented);
  presentedRef.current = presented;
  const routeClosingRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    isPresented.value = presented;
    if (presented) {
      translateY.value = withTiming(0, OPEN_TIMING);
    } else {
      hide(onHidden);
    }
  }, [hide, isPresented, onHidden, presented, translateY]);

  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const requestClose = useCallback(() => {
    if (!dismissible) {
      settle();
      return;
    }
    if (closeAfterAnimation) {
      // Two close triggers in a row must not dismiss the route twice.
      if (routeClosingRef.current) return;
      routeClosingRef.current = true;
      isPresented.value = false;
      hide(onClose);
      return;
    }
    if (!presentedRef.current) return;
    onClose();
    // A parent that refuses to close (for example while saving) leaves the sheet open.
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      if (presentedRef.current) settle();
    }, 80);
  }, [closeAfterAnimation, dismissible, hide, isPresented, onClose, settle]);

  // Android back on a route drawer animates it away like the other close paths.
  useEffect(() => {
    if (!closeAfterAnimation) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [closeAfterAnimation, requestClose]);

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
        // A closing sheet ignores touches, so a drag cannot interrupt its exit animation.
        .enabled(dismissible && presented)
        // Only a downward drag can start moving the sheet; upward drags are scrolls.
        .activeOffsetY(8)
        .failOffsetX([-16, 16])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          dragAnchor.value = 0;
          closing.value = false;
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
            closing.value = true;
            runOnJS(requestClose)();
          }
        })
        // Runs after onEnd and also when the system cancels the drag midway.
        .onFinalize(() => {
          if (!closing.value && isPresented.value && translateY.value > 0) {
            translateY.value = withSpring(0, SETTLE_SPRING);
          }
        }),
    [closing, dismissible, dragAnchor, isPresented, presented, requestClose, scrollGesture, scrollY, touchingScroll, translateY],
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
      pointerEvents={presented ? "auto" : "none"}
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
          // The keyboard covers the home indicator, so its inset would only add a gap.
          paddingBottom: padBottom && !keyboardVisible ? insets.bottom : 0,
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
      <SheetDepthContext.Provider value={depth + 1}>
        <SheetDismissContext.Provider value={requestClose}>
          <SheetGestureContext.Provider value={gestureState}>
            <View style={[styles.content, { flexGrow: size === "tall" ? 1 : 0 }]}>{children}</View>
          </SheetGestureContext.Provider>
        </SheetDismissContext.Provider>
      </SheetDepthContext.Provider>
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
  surface = "raised",
  children,
}: SheetProps) {
  const [mounted, setMounted] = useState(visible);
  // Parents often clear the data behind a sheet as they close it; keep showing the last content
  // while the sheet slides away.
  const lastChildren = useRef(children);
  if (visible) lastChildren.current = children;

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const handleHidden = useCallback(() => {
    setMounted(false);
    // React Native only reports Modal.onDismiss on iOS.
    if (Platform.OS !== "ios") onDismissRef.current?.();
  }, []);

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
            surfaceColor={surface === "base" ? "#09090b" : "#18181b"}
            contentDraggable={contentDraggable}
            closeLabel={closeLabel}
          >
            {visible ? children : lastChildren.current}
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

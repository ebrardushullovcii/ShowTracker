import { createContext, forwardRef, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View, type ScrollViewProps } from "react-native";
import { Drawer } from "vaul";
import { Ionicons } from "@expo/vector-icons";
import { DialogBackdrop, TallDialog } from "@/components/DialogBackdrop";
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

// vaul already lets a scrolled element keep the drag until it reaches its top edge, and content in an
// iframe (the share composer) never reaches vaul, so `contentDraggable` needs no web handling.
export const SheetScrollView = forwardRef<ScrollView, ScrollViewProps>(function SheetScrollView(props, ref) {
  return <ScrollView ref={ref} {...props} />;
});

const SheetDismissContext = createContext<(() => void) | null>(null);

/** Close action for buttons inside a sheet: animates the sheet out before `fallback` runs. */
export function useSheetDismiss(fallback: () => void) {
  return useContext(SheetDismissContext) ?? fallback;
}

/** vaul already leaves scrollable content alone, so the handle needs no extra gesture on web. */
export function SheetDragHandle({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// vaul's close transition is 500ms.
const CLOSE_ANIMATION_MS = 500;

// Sheets sit below react-native-web's Modal layer so confirmation dialogs opened from a sheet stay on top.
// vaul portals every drawer straight into <body>, so a drawer opened from another one needs a higher layer.
const SHEET_Z_INDEX = 900;
const sheetLayer = (depth: number) => SHEET_Z_INDEX + depth * 2;

const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function Grabber({ closeLabel, onClose }: { closeLabel?: string; onClose: () => void }) {
  const bar = <div aria-hidden style={{ width: 40, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />;
  if (!closeLabel) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 6px", flexShrink: 0 }}>{bar}</div>;
  }
  // The close button shares the grabber row so the sheet spends no extra height on a header.
  return (
    <div style={{ position: "relative", height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {bar}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        style={{
          position: "absolute",
          right: 12,
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "none",
          background: "rgba(255,255,255,0.1)",
          cursor: "pointer",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={18} color="#e4e4e7" />
      </button>
    </div>
  );
}

type MobileDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
  label: string;
  size: SheetSize;
  dismissible: boolean;
  background: string;
  closeLabel?: string;
  /** Route content already pads its own bottom safe area. */
  padBottom?: boolean;
  children: ReactNode;
};

function MobileDrawer({
  open,
  onOpenChange,
  onClosed,
  label,
  size,
  dismissible,
  background,
  closeLabel,
  padBottom = true,
  children,
}: MobileDrawerProps) {
  const { maxHeight, insets, depth } = useSheetMetrics();
  const layer = sheetLayer(depth);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const wasOpen = useRef(open);
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    if (dismissible) onOpenChange(false);
  };

  // vaul does not report the end of its close animation in non-modal mode, so wait it out.
  // Until then the backdrop keeps catching taps, so nothing underneath opens mid-close.
  useEffect(() => {
    if (wasOpen.current && !open) {
      wasOpen.current = open;
      setClosing(true);
      const timer = setTimeout(() => {
        setClosing(false);
        onClosedRef.current?.();
      }, CLOSE_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      // Non-modal keeps react-native-web dialogs opened from inside the sheet clickable.
      modal={false}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <div
          aria-hidden
          onClick={requestClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: layer,
            background: "rgba(0,0,0,0.45)",
            // Swiping the dimmed page must not scroll the page behind it.
            touchAction: "none",
            overscrollBehavior: "contain",
            opacity: open ? 1 : 0,
            transition: "opacity 300ms cubic-bezier(0.32, 0.72, 0, 1)",
            pointerEvents: open || closing ? "auto" : "none",
          }}
        />
        <Drawer.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: layer + 1,
            display: "flex",
            flexDirection: "column",
            // The app's global `body > div { min-height: 100% }` would otherwise stretch the portal.
            minHeight: 0,
            height: size === "tall" ? maxHeight : "auto",
            maxHeight,
            paddingBottom: padBottom ? insets.bottom : 0,
            background,
            borderTopLeftRadius: SHEET_CORNER_RADIUS,
            borderTopRightRadius: SHEET_CORNER_RADIUS,
            border: "1px solid rgba(255,255,255,0.12)",
            borderBottom: "none",
            overflow: "hidden",
            outline: "none",
          }}
        >
          <Drawer.Title style={srOnly}>{label}</Drawer.Title>
          <Grabber closeLabel={closeLabel} onClose={requestClose} />
          <div style={{ display: "flex", flexDirection: "column", flexGrow: size === "tall" ? 1 : 0, flexShrink: 1, minHeight: 0 }}>
            <SheetDepthContext.Provider value={depth + 1}>
              <SheetDismissContext.Provider value={requestClose}>{children}</SheetDismissContext.Provider>
            </SheetDepthContext.Provider>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Corner close button for the centered desktop dialog, which has no grabber row. */
function DesktopCloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
    >
      <Ionicons name="close" size={18} color="#e4e4e7" />
    </Pressable>
  );
}

export function Sheet({
  visible,
  onClose,
  label,
  size = "auto",
  dismissible = true,
  avoidKeyboard = false,
  maxWidth = 512,
  closeLabel,
  onDismiss,
  surface = "raised",
  children,
}: SheetProps) {
  const { isDesktop } = useSheetMetrics();
  // Parents often clear the data behind a sheet as they close it; keep the last content while it slides away.
  const lastChildren = useRef(children);
  if (visible) lastChildren.current = children;
  const closeIfDismissible = () => {
    if (dismissible) onClose();
  };

  if (isDesktop) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (dismissible) onClose();
        }}
        onDismiss={onDismiss}
      >
        <DialogBackdrop avoidKeyboard={avoidKeyboard}>
          <Pressable
            className="absolute inset-0"
            accessible={false}
            focusable={false}
            onPress={closeIfDismissible}
          />
          <View
            accessibilityViewIsModal
            accessibilityLabel={label}
            className="dialog-panel"
            style={{ maxWidth, height: size === "tall" ? "85%" : undefined }}
          >
            {/* Stands in for the phone grabber row above the drawer header. */}
            <View className="h-3" />
            <SheetDismissContext.Provider value={closeIfDismissible}>{children}</SheetDismissContext.Provider>
            {closeLabel ? <DesktopCloseButton label={closeLabel} onPress={closeIfDismissible} /> : null}
          </View>
        </DialogBackdrop>
      </Modal>
    );
  }

  return (
    <MobileDrawer
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onClosed={onDismiss}
      label={label}
      size={size}
      dismissible={dismissible}
      background={surface === "base" ? "#09090b" : "#18181b"}
      closeLabel={closeLabel}
    >
      {visible ? children : lastChildren.current}
    </MobileDrawer>
  );
}

export function SheetRouteFrame({ children, onClose, label, maxWidth = 1024, alignEnd, closeLabel }: SheetRouteFrameProps) {
  const { isDesktop } = useSheetMetrics();
  const [open, setOpen] = useState(true);

  if (isDesktop) {
    return (
      <TallDialog onClose={onClose} alignEnd={alignEnd} maxWidth={maxWidth}>
        {closeLabel ? <View className="h-3" /> : null}
        {children}
        {closeLabel ? <DesktopCloseButton label={closeLabel} onPress={onClose} /> : null}
      </TallDialog>
    );
  }

  return (
    <MobileDrawer
      open={open}
      onOpenChange={setOpen}
      onClosed={onClose}
      label={label}
      size="tall"
      dismissible
      background="#09090b"
      closeLabel={closeLabel}
      padBottom={false}
    >
      {children}
    </MobileDrawer>
  );
}

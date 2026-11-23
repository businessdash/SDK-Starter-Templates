import {
  type ComponentRef,
  createContext,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Dimensions,
  Keyboard,
  type KeyboardMetrics,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type ScrollView,
  TextInput,
} from 'react-native'

/**
 * Keyboard handling for Android. An edge-to-edge window (the default since
 * Android 15) doesn't resize when the keyboard opens, so the form and its
 * sheets keep their own inputs in view. iOS uses the scroll views'
 * `automaticallyAdjustKeyboardInsets` instead.
 */

const android = Platform.OS === 'android'

/**
 * How much of the screen's bottom the keyboard covers while it's open on
 * Android, else 0. For full-screen views (a sheet's modal runs under the
 * navigation bar, which the keyboard's own height leaves out).
 */
export function useAndroidKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!android || !active) return
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(
        Math.max(
          Dimensions.get('screen').height - e.endCoordinates.screenY,
          e.endCoordinates.height,
        ),
      ),
    )
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [active])
  return active ? height : 0
}

/**
 * Scrolls the focused input above the keyboard. Text fields call it on focus,
 * so moving between fields with the keyboard open keeps the new one in view.
 * A sheet provides `null`: its inputs aren't in the form's scroll view.
 */
export const BdKeyboardRevealContext = createContext<(() => void) | null>(null)

/** Room to leave between the focused field and the keyboard. */
const GAP = 24

/**
 * Where the keyboard starts, in the coordinates `measureInWindow` uses. The
 * keyboard reports screen coordinates; a window that starts below the status
 * bar is offset from those, and one that runs under the navigation bar is
 * taller than the keyboard's bottom. Each reading can only place the
 * keyboard too low, so the higher of the two is right either way.
 */
function keyboardTopInWindow(k: KeyboardMetrics): number {
  return Math.min(k.screenY, Dimensions.get('window').height - k.height)
}

/**
 * For the form's scroll view: the bottom inset to add while the keyboard is
 * open, the scroll handler that tracks the offset, and `reveal`.
 */
export function useAndroidKeyboardReveal(
  scrollRef: RefObject<ComponentRef<typeof ScrollView> | null>,
  enabled: boolean,
) {
  const [inset, setInset] = useState(0)
  const keyboardTop = useRef<number | null>(null)
  const offset = useRef(0)

  const scrollFocused = useCallback(() => {
    const top = keyboardTop.current
    const input = TextInput.State.currentlyFocusedInput()
    if (top == null || !input) return
    input.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + GAP - top
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true })
      }
    })
  }, [scrollRef])

  // After the frame that lays out the newly focused field.
  const reveal = useCallback(() => {
    setTimeout(scrollFocused, 60)
  }, [scrollFocused])

  useEffect(() => {
    if (!android || !enabled) return
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = keyboardTopInWindow(e.endCoordinates)
      setInset(e.endCoordinates.height)
      reveal()
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null
      setInset(0)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [enabled, reveal])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y
  }, [])

  // The inset (or a growing textarea) changed what the scroll view can reach:
  // until that lays out, a scroll to the field stops short.
  const onContentSizeChange = useCallback(() => {
    if (keyboardTop.current != null) scrollFocused()
  }, [scrollFocused])

  return {
    inset: android ? inset : 0,
    onScroll,
    onContentSizeChange,
    reveal: android && enabled ? reveal : null,
  }
}

import { Capacitor } from "@capacitor/core";

/** True only in the hosted-artifact build (VITE_ARTIFACT=1): no hash paths, no window.print, downloads via the host. */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";

/** True inside the Android app (Capacitor WebView). */
export const IS_NATIVE = Capacitor.isNativePlatform();

/** Phones/tablets: touch screen as the main pointer. `?mobile=1` forces it (for testing). */
export const IS_TOUCH =
  IS_NATIVE ||
  (typeof window !== "undefined" &&
    (matchMedia("(pointer: coarse)").matches || new URLSearchParams(location.search).get("mobile") === "1"));

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.typewriter.manglish",
  appName: "TypeWriter",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    // route fetch() through native HTTP so the online suggestions are not blocked by CORS
    CapacitorHttp: { enabled: true },
  },
};

export default config;

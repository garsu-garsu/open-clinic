import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "open-clinic",

  brand: {
    primaryColor: "#2F6FED",
  },

  // 내 주변을 찾아주는 앱이라 위치가 유일한 필수 권한이에요.
  permissions: [{ name: "geolocation", access: "access" }],

  webBundleDir: "dist",

  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
});

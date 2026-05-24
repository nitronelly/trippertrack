export default ({ config }) => {
  const variant = process.env.APP_VARIANT ?? "production";
  const isDev = variant === "development";

  return {
    expo: {
      name: isDev ? "TripperTrack Dev" : "trippertrack",
      slug: "trippertrack",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      scheme: isDev ? "trippertrackdev" : "trippertrack",
      userInterfaceStyle: "automatic",
      newArchEnabled: true,

      ios: {
        supportsTablet: true,
        infoPlist: {
          NSLocationWhenInUseUsageDescription:
            "TripperTrack uses your location to show your live position to your crew during an active event.",
          NSLocationAlwaysAndWhenInUseUsageDescription:
            "TripperTrack uses your location in the background during an active event so your crew can still see where you are if your phone is locked.",
        },
      },

      android: {
        package: isDev
          ? "com.trippertrack.trippertrack.dev"
          : "com.trippertrack.trippertrack",
        googleServicesFile: "./google-services.json",
        permissions: [
          "ACCESS_FINE_LOCATION",
          "ACCESS_COARSE_LOCATION",
          "ACCESS_BACKGROUND_LOCATION",
          "FOREGROUND_SERVICE",
          "FOREGROUND_SERVICE_LOCATION",
        ],
        config: {
          googleMaps: {
            apiKey: "AIzaSyB1kWSVa_TRKvdP_zLdgRA6EGGZ_tfA2RA",
          },
        },
        adaptiveIcon: {
          backgroundColor: "#000000",
          foregroundImage: "./assets/images/android-icon-foreground.png",
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
      },

      web: {
        output: "static",
        favicon: "./assets/images/favicon.png",
      },

      plugins: [
        "expo-router",
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#ffffff",
            dark: {
              backgroundColor: "#000000",
            },
          },
        ],
        "@react-native-community/datetimepicker",
        "expo-notifications",
        [
          "expo-location",
          {
            locationAlwaysAndWhenInUsePermission:
              "Allow TripperTrack to use your location during an active event, even when the app is in the background.",
            locationWhenInUsePermission:
              "Allow TripperTrack to use your location while you're using the app.",
          },
        ],

        [
          "react-native-background-geolocation",
          {
            license: "eyJhbGciOiJFZERTQSIsImtpZCI6ImVkMjU1MTktbWFpbi12MSJ9.eyJvcyI6ImFuZHJvaWQiLCJhcHBfaWQiOiJjb20udHJpcHBlcnRyYWNrLnRyaXBwZXJ0cmFjayIsIm9yZGVyX251bWJlciI6MTYxNDYsInJlbmV3YWxfdXJsIjoiaHR0cHM6Ly9zaG9wLnRyYW5zaXN0b3Jzb2Z0LmNvbS9jYXJ0LzE2NTA3ODYxNTA1OjE_bm90ZT0xMDcyNCIsImN1c3RvbWVyX2lkIjo5NzQ5LCJwcm9kdWN0IjoicmVhY3QtbmF0aXZlLWJhY2tncm91bmQtZ2VvbG9jYXRpb24iLCJrZXlfdmVyc2lvbiI6MSwiYWxsb3dlZF9zdWZmaXhlcyI6WyIuZGV2IiwiLmRldmVsb3BtZW50IiwiLnN0YWdpbmciLCIuc3RhZ2UiLCIucWEiLCIudWF0IiwiLnRlc3QiLCIuZGVidWciXSwibWF4X2J1aWxkX3N0YW1wIjoyMDI3MDYwMiwiZ3JhY2VfYnVpbGRzIjowLCJlbnRpdGxlbWVudHMiOlsiY29yZSJdLCJpYXQiOjE3Nzc3NTg3NDF9.QiGsec5bgVTJT9cGSPdqXAj7z19lGO5XTT59pIEwIHsky46juPCNkaWPwp-mZQ1cuqykyNElhqooMmLSvtfgBQ"
          }
        ],

        [
          "expo-gradle-ext-vars",
          {
            googlePlayServicesLocationVersion: "21.3.0",
            tslocationmanagerVersion: "4.0.+",
          },
        ],
      ],

      experiments: {
        typedRoutes: true,
        reactCompiler: true,
      },

      extra: {
        router: {},
        eas: {
          projectId: "6a94ac93-7446-42ef-b515-b0b2990ac2eb",
        },
      },
    },
  };
};
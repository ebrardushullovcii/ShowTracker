module.exports = (config) => ({
  type: "widget",
  name: "WatchlistWidget",
  displayName: "ShowTracker",
  bundleIdentifier: ".watchlist-widget",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
  colors: {
    $widgetBackground: "#09090b",
    $accent: "#ef4444",
  },
});

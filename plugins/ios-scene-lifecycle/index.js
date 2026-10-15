// iOS 27 requires the scene life cycle for apps built with Xcode 27, and Expo SDK 54
// has no built-in support for it. Remove this plugin after upgrading to Expo SDK 57 or newer,
// which provides the scene delegate itself.
const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const SCENE_DELEGATE = "SceneDelegate.swift";
const SCENE_DELEGATE_SOURCE = require.resolve(`./${SCENE_DELEGATE}`);

// SDK 54's AppDelegate template creates the window and starts React Native at launch.
// Under scenes the window belongs to the scene, so SceneDelegate starts React Native.
const WINDOW_START = /\n\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const { contents, language } = config.modResults;
    if (language === "swift" && !contents.includes("startReactNative(")) {
      return config;
    }
    if (language !== "swift" || !WINDOW_START.test(contents)) {
      throw new Error("ios-scene-lifecycle: AppDelegate.swift no longer matches the Expo SDK 54 template");
    }
    config.modResults.contents = contents.replace(WINDOW_START, "\n");
    return config;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return config;
  });
}

function withSceneDelegateFile(config) {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      fs.copyFileSync(
        SCENE_DELEGATE_SOURCE,
        path.join(config.modRequest.platformProjectRoot, projectName, SCENE_DELEGATE)
      );
      return config;
    },
  ]);
  return withXcodeProject(config, (config) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const filepath = `${projectName}/${SCENE_DELEGATE}`;
    if (!config.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: config.modResults,
      });
    }
    return config;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneDelegateFile(withSceneManifest(withSceneAppDelegate(config)));
};

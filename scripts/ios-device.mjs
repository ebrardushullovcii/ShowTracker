// Builds a standalone Release app (JS bundled, no Metro) and installs it on a connected iPhone
// with Xcode automatic signing. Reruns reuse ios/, Pods and ios/build, so renewing a free
// Personal Team profile is an incremental build plus an in-place install that keeps app data.
//
// Required environment (keep machine and account values out of the repo):
//   SHOWTRACKER_IOS_TEAM    Apple team ID used for signing
//   SHOWTRACKER_IOS_DEVICE  devicectl identifier or UDID of the connected iPhone
//   EXPO_PUBLIC_CONVEX_URL, EXPO_PUBLIC_CONVEX_SITE_URL  the backend to bundle
// Other EXPO_PUBLIC_* values come from the usual .env files.
//
// Flags: --refresh-native regenerates ios/ and reinstalls Pods; --no-install only builds.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const iosDir = path.join(root, "ios");
const buildDir = path.join(iosDir, "build");
const logDir = path.join(buildDir, "device-logs");
const app = path.join(buildDir, "Build/Products/Release-iphoneos/ShowTracker.app");
const args = new Set(process.argv.slice(2));
const stamp = new Date().toISOString().replaceAll(":", "-");

const team = process.env.SHOWTRACKER_IOS_TEAM;
const device = process.env.SHOWTRACKER_IOS_DEVICE;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!team || !device || !convexUrl || !convexSiteUrl) {
  throw new Error(
    "Set SHOWTRACKER_IOS_TEAM, SHOWTRACKER_IOS_DEVICE, EXPO_PUBLIC_CONVEX_URL and EXPO_PUBLIC_CONVEX_SITE_URL"
  );
}

const env = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  NODE_BINARY: process.execPath,
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
  EXPO_NO_TELEMETRY: "1",
};

function run(name, command, argv, cwd = root) {
  fs.mkdirSync(logDir, { recursive: true });
  const log = path.join(logDir, `${stamp}-${name}.log`);
  const started = Date.now();
  console.log(`${name}: running, log ${log}`);
  const fd = fs.openSync(log, "w");
  const result = spawnSync(command, argv, { cwd, env, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.status !== 0) {
    throw new Error(`${name} failed after ${seconds}s; see ${log}`);
  }
  console.log(`${name}: done in ${seconds}s`);
}

function deviceUdid() {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "showtracker-devices-")), "devices.json");
  execFileSync("xcrun", ["devicectl", "list", "devices", "--json-output", output], { stdio: "ignore" });
  const devices = JSON.parse(fs.readFileSync(output, "utf8")).result.devices;
  const match = devices.find(
    (candidate) => candidate.identifier === device || candidate.hardwareProperties?.udid === device
  );
  if (!match?.hardwareProperties?.udid) {
    throw new Error("The iPhone is not connected or paired; connect it by USB and unlock it");
  }
  return match.hardwareProperties.udid;
}

function profileExpiry() {
  const plist = execFileSync("security", ["cms", "-D", "-i", path.join(app, "embedded.mobileprovision")], {
    encoding: "utf8",
  });
  return plist.match(/<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/)?.[1];
}

if (execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()) {
  throw new Error("Commit or stash changes first; the app bundles the checked-out source");
}
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
console.log(`Building ${commit} against ${convexUrl}`);

if (args.has("--refresh-native") || !fs.existsSync(path.join(iosDir, "Podfile"))) {
  run("prebuild", "npx", ["expo", "prebuild", "--platform", "ios", "--clean", "--no-install"]);
  // Prebuild adds run scripts to package.json; this project keeps native folders generated.
  execFileSync("git", ["checkout", "--", "package.json"], { cwd: root });
}
if (args.has("--refresh-native") || !fs.existsSync(path.join(iosDir, "Pods/Manifest.lock"))) {
  run("pods", "pod", ["install"], iosDir);
}

const udid = deviceUdid();
run("build", "xcodebuild", [
  "-workspace", "ShowTracker.xcworkspace",
  "-scheme", "ShowTracker",
  "-configuration", "Release",
  "-destination", `platform=iOS,id=${udid}`,
  "-derivedDataPath", buildDir,
  "-jobs", "2",
  "-allowProvisioningUpdates",
  "-allowProvisioningDeviceRegistration",
  `DEVELOPMENT_TEAM=${team}`,
  "CODE_SIGN_STYLE=Automatic",
  // Xcode 27 rejects the 9.0 target of SDWebImage's resource bundle; every other target is 15.1.
  "IPHONEOS_DEPLOYMENT_TARGET=15.1",
  "build",
], iosDir);

if (!fs.readFileSync(path.join(app, "main.jsbundle")).includes(convexUrl)) {
  throw new Error("The bundled JavaScript does not contain EXPO_PUBLIC_CONVEX_URL");
}
console.log(`Signing profile expires ${profileExpiry()}`);

if (!args.has("--no-install")) {
  run("install", "xcrun", ["devicectl", "device", "install", "app", "--device", device, app]);
  const bundleId = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.ios.bundleIdentifier;
  run("launch", "xcrun", ["devicectl", "device", "process", "launch", "--device", device, bundleId]);
}

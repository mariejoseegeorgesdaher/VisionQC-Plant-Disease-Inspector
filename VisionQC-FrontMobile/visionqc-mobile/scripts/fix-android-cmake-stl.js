const fs = require("fs");
const path = require("path");

const root = process.cwd();

const patches = [
  {
    file: "node_modules/expo-modules-core/android/CMakeLists.txt",
    from: "  ReactAndroid::jsi\n  android",
    to: "  ReactAndroid::jsi\n  c++_shared\n  android",
  },
  {
    file: "node_modules/react-native-screens/android/CMakeLists.txt",
    from: "            fbjni::fbjni\n            android",
    to: "            fbjni::fbjni\n            c++_shared\n            android",
  },
  {
    file: "node_modules/react-native-screens/android/CMakeLists.txt",
    from: "                fbjni::fbjni\n                android",
    to: "                fbjni::fbjni\n                c++_shared\n                android",
  },
  {
    file: "node_modules/react-native-screens/android/CMakeLists.txt",
    from: "        ReactAndroid::jsi\n        android",
    to: "        ReactAndroid::jsi\n        c++_shared\n        android",
  },
  {
    file: "node_modules/react-native-worklets/android/CMakeLists.txt",
    from: "target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni)",
    to: "target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni c++_shared)",
  },
  {
    file: "node_modules/react-native-reanimated/android/CMakeLists.txt",
    from: "target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android",
    to: "target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni c++_shared android",
  },
  {
    file: "node_modules/react-native-gesture-handler/android/src/main/jni/CMakeLists.txt",
    from: "  fbjni::fbjni\n)",
    to: "  fbjni::fbjni\n  c++_shared\n)",
  },
];

let changed = 0;

for (const patch of patches) {
  const fullPath = path.join(root, patch.file);
  if (!fs.existsSync(fullPath)) continue;

  const original = fs.readFileSync(fullPath, "utf8");
  if (original.includes(patch.to)) continue;
  if (!original.includes(patch.from)) continue;

  const updated = original.replace(patch.from, patch.to);
  fs.writeFileSync(fullPath, updated, "utf8");
  changed += 1;
}

if (changed > 0) {
  console.log(`[fix-android-cmake-stl] applied ${changed} patch(es)`);
} else {
  console.log("[fix-android-cmake-stl] no changes needed");
}

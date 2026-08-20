const { withAppBuildGradle } = require("@expo/config-plugins");

const cmakeBuildStagingBlock = `

    externalNativeBuild {
        cmake {
            // Shorten the base path so CMake has room to hash long codegen paths.
            buildStagingDirectory file("\${rootDir}/../../../.cxx/app")
        }
    }`;

const cmakePathLimitBlock = `

        // Keep generated C/C++ object paths below Windows' MAX_PATH limit.
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=250"
            }
        }`;

module.exports = function withCmakeObjectPathLimit(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "withCmakeObjectPathLimit only supports Groovy build.gradle files",
      );
    }

    if (!config.modResults.contents.includes("buildStagingDirectory")) {
      const namespacePattern = /(\s+namespace\s+[^\r\n]+)/;

      if (!namespacePattern.test(config.modResults.contents)) {
        throw new Error(
          "Could not find android.namespace in android/app/build.gradle",
        );
      }

      config.modResults.contents = config.modResults.contents.replace(
        namespacePattern,
        `$1${cmakeBuildStagingBlock}`,
      );
    }

    if (!config.modResults.contents.includes("-DCMAKE_OBJECT_PATH_MAX=")) {
      const versionNamePattern = /(\s+versionName\s+[^\r\n]+)/;

      if (!versionNamePattern.test(config.modResults.contents)) {
        throw new Error(
          "Could not find defaultConfig.versionName in android/app/build.gradle",
        );
      }

      config.modResults.contents = config.modResults.contents.replace(
        versionNamePattern,
        `$1${cmakePathLimitBlock}`,
      );
    }

    return config;
  });
};

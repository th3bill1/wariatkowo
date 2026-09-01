const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_SOURCE_FILES = [
  "WariatkowoWidget.kt",
  "WariatkowoWidgetModule.kt",
];
const WIDGET_DRAWABLES = ["ic_widget_lightbulb.xml", "ic_widget_snowflake.xml"];
const WIDGET_LAYOUTS = ["wariatkowo_widget_fallback.xml"];

module.exports = function withWariatkowoWidget(config) {
  config = withProjectBuildGradle(config, (current) => {
    current.modResults.contents = current.modResults.contents.replace(
      /ext\.kotlin_version\s*=\s*['"][^'"]+['"]\s*\n?/,
      "",
    );
    if (/ext\.kotlinVersion\s*=/.test(current.modResults.contents)) {
      current.modResults.contents = current.modResults.contents.replace(
        /ext\.kotlinVersion\s*=\s*['"][^'"]+['"]/,
        "ext.kotlinVersion = '2.1.20'",
      );
    } else {
      current.modResults.contents = current.modResults.contents.replace(
        "buildscript {",
        "buildscript {\n    ext.kotlinVersion = '2.1.20'",
      );
    }
    if (
      !current.modResults.contents.includes(
        "org.jetbrains.kotlin.plugin.compose.gradle.plugin",
      )
    ) {
      current.modResults.contents = current.modResults.contents.replace(
        /dependencies\s*\{/,
        'dependencies {\n    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:${kotlinVersion}")',
      );
    }
    return current;
  });

  config = withAppBuildGradle(config, (current) => {
    if (
      !current.modResults.contents.includes(
        'apply plugin: "org.jetbrains.kotlin.plugin.compose"',
      )
    ) {
      current.modResults.contents = current.modResults.contents.replace(
        'apply plugin: "org.jetbrains.kotlin.android"',
        'apply plugin: "org.jetbrains.kotlin.android"\napply plugin: "org.jetbrains.kotlin.plugin.compose"',
      );
    }
    if (!current.modResults.contents.includes("compose true")) {
      current.modResults.contents = current.modResults.contents.replace(
        /android\s*\{/,
        "android {\n    buildFeatures {\n        compose true\n    }",
      );
    }
    const marker = "// Wariatkowo widget";
    if (!current.modResults.contents.includes(marker)) {
      current.modResults.contents = current.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${marker}\n    implementation "androidx.glance:glance-appwidget:1.1.1"\n    implementation "androidx.security:security-crypto:1.1.0-alpha06"`,
      );
    }
    return current;
  });

  config = withAndroidManifest(config, (current) => {
    const application = current.modResults.manifest.application[0];
    application.receiver = application.receiver || [];
    const existingReceiver = application.receiver.find(
      (receiver) =>
        receiver.$?.["android:name"] === ".widget.WariatkowoWidgetReceiver",
    );
    if (existingReceiver) {
      existingReceiver.$["android:exported"] = "true";
    } else {
      application.receiver.push({
        $: {
          "android:name": ".widget.WariatkowoWidgetReceiver",
          "android:exported": "true",
          "android:label": "Wariatkowo",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.appwidget.action.APPWIDGET_UPDATE",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/wariatkowo_widget_info",
            },
          },
        ],
      });
    }
    return current;
  });

  return withDangerousMod(config, [
    "android",
    async (current) => {
      const root = current.modRequest.platformProjectRoot;
      const source = path.join(__dirname, "widget");
      const packageDirectory = path.join(
        root,
        "app/src/main/java/com/wariatkowo/mobile/widget",
      );
      const xmlDirectory = path.join(root, "app/src/main/res/xml");
      const drawableDirectory = path.join(root, "app/src/main/res/drawable");
      const layoutDirectory = path.join(root, "app/src/main/res/layout");
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.mkdirSync(xmlDirectory, { recursive: true });
      fs.mkdirSync(drawableDirectory, { recursive: true });
      fs.mkdirSync(layoutDirectory, { recursive: true });

      for (const file of WIDGET_SOURCE_FILES) {
        fs.copyFileSync(
          path.join(source, file),
          path.join(packageDirectory, file),
        );
      }
      for (const file of WIDGET_DRAWABLES) {
        fs.copyFileSync(
          path.join(source, file),
          path.join(drawableDirectory, file),
        );
      }
      for (const file of WIDGET_LAYOUTS) {
        fs.copyFileSync(
          path.join(source, file),
          path.join(layoutDirectory, file),
        );
      }
      fs.writeFileSync(
        path.join(xmlDirectory, "wariatkowo_widget_info.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:initialLayout="@layout/glance_default_loading_layout"
  android:minWidth="250dp"
  android:minHeight="150dp"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="1800000"
  android:widgetCategory="home_screen" />
`,
      );

      const mainApplication = path.join(
        root,
        "app/src/main/java/com/wariatkowo/mobile/MainApplication.kt",
      );
      if (fs.existsSync(mainApplication)) {
        let contents = fs.readFileSync(mainApplication, "utf8");
        if (!contents.includes("WariatkowoWidgetPackage")) {
          contents = contents.replace(
            "import com.facebook.react.ReactPackage",
            "import com.facebook.react.ReactPackage\nimport com.wariatkowo.mobile.widget.WariatkowoWidgetPackage",
          );
          contents = contents.replace(
            "PackageList(this).packages.apply {",
            "PackageList(this).packages.apply {\n              add(WariatkowoWidgetPackage())",
          );
          fs.writeFileSync(mainApplication, contents);
        }
      }
      return current;
    },
  ]);
};

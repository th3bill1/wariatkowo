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
const WIDGET_DRAWABLES = [
  "ic_widget_lightbulb.xml",
  "ic_widget_snowflake.xml",
  "ic_widget_settings.xml",
];

module.exports = function withWariatkowoWidget(config) {
  config = withProjectBuildGradle(config, (current) => {
    if (!current.modResults.contents.includes("kotlin_version = '2.0.21'")) {
      current.modResults.contents = current.modResults.contents.replace(
        "buildscript {",
        "buildscript {\n    ext.kotlin_version = '2.0.21'",
      );
    }
    return current;
  });

  config = withAppBuildGradle(config, (current) => {
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
    if (
      !application.receiver.some(
        (receiver) =>
          receiver.$?.["android:name"] === ".widget.WariatkowoWidgetReceiver",
      )
    ) {
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
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.mkdirSync(xmlDirectory, { recursive: true });
      fs.mkdirSync(drawableDirectory, { recursive: true });

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

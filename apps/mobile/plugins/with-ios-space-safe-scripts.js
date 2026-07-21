/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");

const marker = "# Karya: keep Expo Constants compatible with app paths containing spaces.";
const patch = `

    ${marker}
    installer.pods_project.targets.each do |target|
      if target.name == 'ExpoSQLite'
        # Xcode 26 explicit modules fail to provide _Builtin_stdarg while
        # compiling ExpoSQLite's vendored sqlite3.h module.
        target.build_configurations.each do |configuration|
          configuration.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
          configuration.build_settings['SWIFT_INCLUDE_PATHS'] = '$(inherited) $(PODS_TARGET_SRCROOT)'
        end

        sqlite_module = target.source_build_phase.files_references.find { |file| file.path == 'SQLiteModule.swift' }
        if sqlite_module
          sqlite_root = File.dirname(sqlite_module.real_path.to_s)
          File.write(File.join(sqlite_root, 'module.modulemap'), "module ExpoSQLiteC {\\n  header \\"sqlite3.h\\"\\n  export *\\n}\\n")
          ['SQLiteModule.swift', 'Exceptions.swift'].each do |filename|
            source_path = File.join(sqlite_root, filename)
            source = File.read(source_path)
            source = source.gsub(/^import ExpoSQLiteC$/, '@_implementationOnly import ExpoSQLiteC')
            source = "@_implementationOnly import ExpoSQLiteC\\n" + source unless source.include?('import ExpoSQLiteC')
            File.write(source_path, source)
          end
        end
      end

      next unless target.name == 'EXConstants'

      target.shell_script_build_phases.each do |phase|
        next unless phase.name == '[CP-User] Generate app.config for prebuilt Constants.manifest'
        phase.shell_script = 'bash "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"'
      end
    end`;

module.exports = function withIosSpaceSafeScripts(config) {
  config = withXcodeProject(config, (modConfig) => {
    const phases = modConfig.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    for (const phase of Object.values(phases)) {
      if (!phase || typeof phase !== "object" || phase.name !== '"Bundle React Native code and images"') continue;
      const script = JSON.parse(phase.shellScript);
      const unsafeInvocation =
        "`\"$NODE_BINARY\" --print \"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\"`";
      const safeInvocation =
        'RN_XCODE_SCRIPT="$("$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'" )"\n/bin/sh "$RN_XCODE_SCRIPT"';
      if (script.includes(unsafeInvocation))
        phase.shellScript = JSON.stringify(script.replace(unsafeInvocation, safeInvocation));
    }
    return modConfig;
  });

  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const propertiesPath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile.properties.json");
      const properties = JSON.parse(fs.readFileSync(propertiesPath, "utf8"));
      properties["ios.buildReactNativeFromSource"] = "true";
      fs.writeFileSync(propertiesPath, `${JSON.stringify(properties, null, 2)}\n`);

      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
      const source = fs.readFileSync(podfilePath, "utf8");
      if (source.includes(marker)) return modConfig;

      const closing = "    )\n  end\nend";
      if (!source.includes(closing)) throw new Error("Unable to install Karya's iOS path-safe CocoaPods patch.");
      fs.writeFileSync(podfilePath, source.replace(closing, `    )${patch}\n  end\nend`));
      return modConfig;
    },
  ]);
};

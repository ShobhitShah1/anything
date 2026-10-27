const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withCmake(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = '// Anything: modern Ninja supports Windows long paths.';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `
${marker}
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                def localNinja = new File(rootDir.parentFile, ".tools/ninja/ninja.exe")
                if (System.getProperty("os.name").toLowerCase().contains("windows") && localNinja.isFile()) {
                    arguments "-DCMAKE_MAKE_PROGRAM=" + localNinja.absolutePath.replace(File.separator, "/")
                }
            }
        }
    }
}
`;
    }
    return config;
  });
};

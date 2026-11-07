const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = '// Anything: private local signing for both build variants.';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `
${marker}
def anythingCredentials = new File(rootDir.parentFile, "credentials.json")
if (anythingCredentials.isFile()) {
    def key = new groovy.json.JsonSlurper().parse(anythingCredentials).android.keystore
    android {
        signingConfigs {
            anythingRelease {
                storeFile new File(rootDir.parentFile, key.keystorePath)
                storePassword key.keystorePassword
                keyAlias key.keyAlias
                keyPassword key.keyPassword
            }
        }
        buildTypes {
            debug { signingConfig signingConfigs.anythingRelease }
            release { signingConfig signingConfigs.anythingRelease }
        }
    }
} else if (System.getenv("EAS_BUILD") != "true") {
    throw new GradleException("Anything signing credentials are missing. Restore credentials.json and its JKS before building.")
}
`;
    }
    return config;
  });
};

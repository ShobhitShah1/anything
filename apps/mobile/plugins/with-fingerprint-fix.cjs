const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function withFingerprintFix(config) {
  return withProjectBuildGradle(config, (config) => {
    const marker = '// Anything: disable fragile debug fingerprint generation on Windows';

    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `
${marker}
gradle.projectsEvaluated {
    subprojects { project ->
        if (project.name == 'expo-constants') {
            project.tasks.matching { it.name == 'createExpoFingerprint' }.configureEach {
                enabled = false
            }
        }
    }
}
`;
    }

    return config;
  });
};

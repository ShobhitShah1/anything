const {
  withMainActivity,
  withAndroidManifest,
  withAndroidStyles,
  withDangerousMod,
} = require('expo/config-plugins');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

function patchActivity(contents) {
  contents = contents
    .replace(/^\s*\/\/ This is required for expo-splash-screen\.\s*$/gm, '')
    .replace(/^import expo\.modules\.splashscreen\.SplashScreenManager\s*$/gm, '')
    .replace(
      /\s*\/\/ @generated begin expo-splashscreen[\s\S]*?\/\/ @generated end expo-splashscreen/g,
      '',
    )
    .replace(/^\s*SplashScreenManager\.registerOnActivity\(this\)\s*$/gm, '');
  if (contents.includes('AnythingLaunch.show(this)')) return contents;
  if (!contents.includes('super.onCreate(null)'))
    throw new Error('Custom launch expects the Expo Kotlin MainActivity onCreate(null) template.');
  return contents
    .replace(/(package [^\r\n]+)/, '$1\nimport expo.modules.anythinglaunch.AnythingLaunch')
    .replace(
      'super.onCreate(null)',
      'setTheme(R.style.AppTheme)\n    super.onCreate(null)\n    AnythingLaunch.show(this)',
    );
}

module.exports = function withAndroidLaunch(config) {
  config = withMainActivity(config, (mod) => {
    mod.modResults.contents = patchActivity(mod.modResults.contents);
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const main = mod.modResults.manifest.application[0].activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity',
    );
    if (!main) throw new Error('MainActivity is missing from the Android manifest.');
    main.$['android:theme'] = '@style/AnythingLaunchTheme';
    return mod;
  });
  config = withAndroidStyles(config, (mod) => {
    const styles = (mod.modResults.resources.style ??= []);
    mod.modResults.resources.style = styles.filter(
      (style) => style.$.name !== 'Theme.App.SplashScreen',
    );
    const current = mod.modResults.resources.style;
    const launch = {
      $: { name: 'AnythingLaunchTheme', parent: 'AppTheme' },
      item: [{ $: { name: 'android:windowBackground' }, _: '@drawable/anything_launch_window' }],
    };
    const index = current.findIndex((style) => style.$.name === 'AnythingLaunchTheme');
    if (index < 0) current.push(launch);
    else current[index] = launch;
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const dir = join(mod.modRequest.platformProjectRoot, 'app/src/main/res/values-v31');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'anything-launch.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AnythingLaunchTheme" parent="AppTheme">
    <item name="android:windowBackground">@drawable/anything_launch_window</item>
    <item name="android:windowSplashScreenBackground">#0d0d0f</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/anything_launch_empty</item>
    <item name="android:windowSplashScreenAnimationDuration">0</item>
  </style>
</resources>
`,
      );
      return mod;
    },
  ]);
};
module.exports.patchActivity = patchActivity;

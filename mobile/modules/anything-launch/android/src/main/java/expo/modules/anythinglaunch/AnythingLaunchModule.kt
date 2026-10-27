package expo.modules.anythinglaunch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AnythingLaunchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AnythingLaunch")
    AsyncFunction("hide") { reducedMotion: Boolean, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve()
      } else {
        activity.runOnUiThread {
          AnythingLaunch.hide(activity, reducedMotion) { promise.resolve() }
        }
      }
    }
  }
}

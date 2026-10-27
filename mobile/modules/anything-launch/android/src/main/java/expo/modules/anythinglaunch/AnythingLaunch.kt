package expo.modules.anythinglaunch

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.view.ViewGroup
import android.view.animation.PathInterpolator
import android.widget.ImageView

object AnythingLaunch {
  private const val TAG = "anything-launch-art"

  fun show(activity: Activity) {
    activity.window.setBackgroundDrawable(ColorDrawable(Color.rgb(13, 13, 15)))
    if (Build.VERSION.SDK_INT >= 31) {
      activity.splashScreen.setOnExitAnimationListener { it.remove() }
    }
    val decor = activity.window.decorView as ViewGroup
    if (decor.findViewWithTag<LaunchArtwork>(TAG) != null) return
    decor.addView(LaunchArtwork(activity).apply { tag = TAG },
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  fun hide(activity: Activity, reducedMotion: Boolean, done: () -> Unit) {
    val art = activity.window.decorView.findViewWithTag<LaunchArtwork>(TAG)
    if (art == null) done() else art.hide(reducedMotion, done)
  }
}

private class LaunchArtwork(context: Context) : ImageView(context) {
  private var introFinished = false
  private var onHidden: (() -> Unit)? = null
  private val motionEnabled = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()

  init {
    scaleType = ScaleType.CENTER_CROP
    setBackgroundColor(Color.rgb(13, 13, 15))
    setImageResource(R.drawable.anything_launch_art)
    elevation = 100f
    isClickable = true
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    scaleX = if (motionEnabled) 0.98f else 1f
    scaleY = scaleX
    animate().scaleX(1f).scaleY(1f).setDuration(if (motionEnabled) 420L else 0L)
      .setInterpolator(PathInterpolator(0.23f, 1f, 0.32f, 1f))
      .withEndAction {
        introFinished = true
        if (onHidden != null) fadeOut(if (motionEnabled) 180L else 0L)
      }.start()
  }

  fun hide(reducedMotion: Boolean, done: () -> Unit) {
    onHidden = done
    if (reducedMotion) {
      animate().cancel()
      introFinished = true
      scaleX = 1f
      scaleY = 1f
      translationY = 0f
    }
    if (introFinished) fadeOut(if (reducedMotion || !motionEnabled) 0L else 180L)
  }

  private fun fadeOut(duration: Long) {
    animate().alpha(0f).setDuration(duration).withEndAction {
      val done = onHidden
      onHidden = null
      (parent as? ViewGroup)?.removeView(this)
      setImageDrawable(null)
      done?.invoke()
    }.start()
  }

  override fun onDetachedFromWindow() {
    animate().cancel()
    val done = onHidden
    onHidden = null
    done?.invoke()
    super.onDetachedFromWindow()
  }
}

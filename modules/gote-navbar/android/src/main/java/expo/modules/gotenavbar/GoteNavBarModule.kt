package expo.modules.gotenavbar

import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Light or dark buttons (and contrast scrim) on Android's navigation bar, to
// follow the app's own theme rather than the phone's.
//
// React Native picks the bar once, from the SYSTEM theme, when the activity
// starts; gote's Light / Dark / System setting never reaches it, so a dark app
// on a light phone had a light grey bar under every screen.
//
// Not androidx's WindowInsetsControllerCompat (which expo-navigation-bar uses):
// on Android 11+ it also rewrites the deprecated systemUiVisibility flags, and
// on Android 12 a light bar it had set could then never be cleared again —
// the app stayed light-barred for good after the first switch. The platform
// WindowInsetsController alone, masked to the navigation-bar bit, is what React
// Native's status bar already uses, and it switches both ways.
class GoteNavBarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoteNavBar")

    // light = true: a light bar with dark buttons (the app is in its light theme).
    Function("setLight") { light: Boolean ->
      val window = appContext.currentActivity?.window ?: return@Function null
      window.decorView.post {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          window.insetsController?.setSystemBarsAppearance(
            if (light) WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS else 0,
            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
          )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          @Suppress("DEPRECATION")
          val decor = window.decorView
          @Suppress("DEPRECATION")
          decor.systemUiVisibility =
            if (light) decor.systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            else decor.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
        }
      }
      null
    }
  }
}

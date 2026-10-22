package expo.modules.gotelocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

// One-shot "where am I" from the Android framework's LocationManager.
//
// This exists instead of expo-location because that library links Google Play
// Services (play-services-location), which F-Droid cannot ship. The framework
// API needs no extra library; the permission prompt stays on the JS side
// (PermissionsAndroid), so this module only checks that it was granted.
//
// The app asks for coarse location only, which is all "species near you" needs,
// so GPS is used only if precise location happens to be granted too.
class GoteLocationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("GoteLocation")

    // Resolves { latitude, longitude, accuracy }. Rejects with
    // E_PERMISSION, E_UNAVAILABLE (no provider is on) or E_TIMEOUT.
    AsyncFunction("getCurrentPosition") { timeoutMs: Int, promise: Promise ->
      currentPosition(timeoutMs.toLong(), promise)
    }
  }

  private fun has(permission: String) =
    context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

  private fun providersFor(manager: LocationManager): List<String> {
    val enabled = manager.getProviders(true)
    val wanted = mutableListOf(LocationManager.NETWORK_PROVIDER)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) wanted.add(LocationManager.FUSED_PROVIDER)
    if (has(Manifest.permission.ACCESS_FINE_LOCATION)) wanted.add(LocationManager.GPS_PROVIDER)
    return wanted.filter { it in enabled }
  }

  private fun lastKnown(manager: LocationManager, providers: List<String>): Location? =
    providers
      .mapNotNull {
        try {
          manager.getLastKnownLocation(it)
        } catch (e: SecurityException) {
          null
        }
      }
      .maxByOrNull { it.time }

  private fun currentPosition(timeoutMs: Long, promise: Promise) {
    if (!has(Manifest.permission.ACCESS_COARSE_LOCATION) && !has(Manifest.permission.ACCESS_FINE_LOCATION)) {
      promise.reject("E_PERMISSION", "Location permission is not granted", null)
      return
    }

    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = providersFor(manager)
    if (providers.isEmpty()) {
      promise.reject("E_UNAVAILABLE", "No location provider is enabled", null)
      return
    }

    val done = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())

    fun finish(location: Location?) {
      if (!done.compareAndSet(false, true)) return
      handler.removeCallbacksAndMessages(null)
      val fix = location ?: lastKnown(manager, providers)
      if (fix == null) {
        promise.reject("E_TIMEOUT", "Could not get a location fix", null)
      } else {
        promise.resolve(
          mapOf(
            "latitude" to fix.latitude,
            "longitude" to fix.longitude,
            "accuracy" to fix.accuracy.toDouble()
          )
        )
      }
    }

    try {
      val provider = providers.first()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val signal = CancellationSignal()
        handler.postDelayed({
          if (!done.get()) {
            signal.cancel()
            finish(null)
          }
        }, timeoutMs)
        manager.getCurrentLocation(provider, signal, context.mainExecutor) { location -> finish(location) }
      } else {
        val listener = object : LocationListener {
          override fun onLocationChanged(location: Location) = finish(location)

          @Deprecated("Needed on API < 29")
          override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

          override fun onProviderEnabled(provider: String) {}

          override fun onProviderDisabled(provider: String) {}
        }
        handler.postDelayed({
          if (!done.get()) {
            manager.removeUpdates(listener)
            finish(null)
          }
        }, timeoutMs)
        @Suppress("DEPRECATION")
        manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
      }
    } catch (e: SecurityException) {
      finish(null)
    }
  }
}

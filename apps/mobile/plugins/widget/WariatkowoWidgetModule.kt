package com.wariatkowo.mobile.widget
import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WariatkowoWidgetModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName() = "WariatkowoWidget"

  @ReactMethod
  fun configure(baseUrl: String, token: String, promise: Promise) {
    prefs().edit().putString("baseUrl", baseUrl).putString("token", token).apply()
    refresh(promise)
  }

  @ReactMethod
  fun refresh(promise: Promise) {
    CoroutineScope(Dispatchers.Default).launch {
      try {
        WariatkowoWidget().updateAll(context)
        promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("WIDGET_REFRESH_FAILED", error)
      }
    }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    prefs().edit().clear().apply()
    refresh(promise)
  }

  private fun prefs() = EncryptedSharedPreferences.create(
    context,
    "wariatkowo_widget",
    MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )
}

class WariatkowoWidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext) =
    listOf<NativeModule>(WariatkowoWidgetModule(context))

  override fun createViewManagers(context: ReactApplicationContext) =
    emptyList<ViewManager<*, *>>()
}


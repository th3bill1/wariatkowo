package com.wariatkowo.mobile.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import androidx.glance.appwidget.updateAll
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
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
    preferences().edit().putString("baseUrl", baseUrl).putString("token", token).apply()
    refresh(promise)
  }

  @ReactMethod
  fun requestPin(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(pinResult(false, false, "unsupported_android"))
      return
    }
    val manager = AppWidgetManager.getInstance(context)
    if (!manager.isRequestPinAppWidgetSupported) {
      promise.resolve(pinResult(false, false, "unsupported_launcher"))
      return
    }
    try {
      val provider = ComponentName(context, WariatkowoWidgetReceiver::class.java)
      val requested = manager.requestPinAppWidget(provider, null, null)
      promise.resolve(pinResult(true, requested, if (requested) null else "request_rejected"))
    } catch (error: Exception) {
      promise.reject("WIDGET_PIN_FAILED", error)
    }
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
    preferences().edit().clear().apply()
    refresh(promise)
  }

  private fun pinResult(supported: Boolean, requested: Boolean, reason: String?) =
    Arguments.createMap().apply {
      putBoolean("supported", supported)
      putBoolean("requested", requested)
      if (reason != null) putString("reason", reason)
    }

  private fun preferences() = EncryptedSharedPreferences.create(
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


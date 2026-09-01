package com.wariatkowo.mobile.widget

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.wariatkowo.mobile.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer

data class WidgetDevice(
  val route: String,
  val name: String,
  val kind: String,
  val id: String?,
  val state: String,
  val available: Boolean,
)

private val deviceDefinitions = listOf(
  WidgetDevice("boskie-swiatlo", "Boskie światło", "light", null, "unknown", false),
  WidgetDevice("miskolampa", "Miśkolampa", "light", null, "unknown", false),
  WidgetDevice("szumownica", "Szumownica", "ac", "ac", "unknown", false),
)

class WariatkowoWidget : GlanceAppWidget(
  errorUiLayout = R.layout.wariatkowo_widget_fallback,
) {
  override val sizeMode = SizeMode.Responsive(
    setOf(DpSize(250.dp, 150.dp), DpSize(320.dp, 180.dp)),
  )

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val (configured, devices) = withContext(Dispatchers.IO) {
      runCatching {
        val preferences = widgetPreferences(context)
        preferences.contains("token") to loadDevices(preferences)
      }.getOrElse { false to deviceDefinitions }
    }
    provideContent { WidgetContent(devices, configured) }
  }
}

@Composable
private fun WidgetContent(devices: List<WidgetDevice>, configured: Boolean) {
  Column(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(ColorProvider(0xfffff8f2.toInt()))
      .padding(12.dp),
  ) {
    Text(
      "Wariatkowo",
      style = TextStyle(
        color = ColorProvider(0xff29252e.toInt()),
        fontWeight = FontWeight.Bold,
        fontSize = 17.sp,
      ),
    )
    Spacer(GlanceModifier.height(4.dp))
    devices.forEach { device -> DeviceRow(device, configured) }
  }
}

@Composable
private fun DeviceRow(device: WidgetDevice, configured: Boolean) {
  val isOn = device.available && device.state != "off"
  val stateLabel = when {
    !configured -> "Zaloguj się"
    !device.available -> "Niedostępne"
    isOn -> "Wł."
    else -> "Wył."
  }
  val toggle = actionRunCallback<ToggleAction>(
    actionParametersOf(DeviceKey to device.route),
  )
  Row(
    modifier = GlanceModifier
      .fillMaxWidth()
      .padding(vertical = 3.dp)
      .background(ColorProvider(if (isOn) 0x267257e8 else 0x12ffffff))
      .clickable(toggle)
      .padding(horizontal = 9.dp, vertical = 7.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Image(
      provider = ImageProvider(
        if (device.kind == "light") R.drawable.ic_widget_lightbulb
        else R.drawable.ic_widget_snowflake,
      ),
      contentDescription = null,
      modifier = GlanceModifier.size(19.dp),
    )
    Spacer(GlanceModifier.width(7.dp))
    Text(
      device.name,
      modifier = GlanceModifier.defaultWeight(),
      maxLines = 1,
      style = TextStyle(
        color = ColorProvider(0xff29252e.toInt()),
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
      ),
    )
    Text(
      stateLabel,
      style = TextStyle(
        color = ColorProvider(
          when {
            !device.available -> 0xff827a89.toInt()
            isOn -> 0xff4f9467.toInt()
            else -> 0xff827a89.toInt()
          },
        ),
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
      ),
    )
  }
}

class WariatkowoWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget = WariatkowoWidget()
}

val DeviceKey = ActionParameters.Key<String>("device")

class ToggleAction : ActionCallback {
  override suspend fun onAction(
    context: Context,
    glanceId: GlanceId,
    parameters: ActionParameters,
  ) {
    val route = parameters[DeviceKey] ?: return
    try {
      withContext(Dispatchers.IO) {
        val preferences = widgetPreferences(context)
        val baseUrl = preferences.getString("baseUrl", null) ?: return@withContext
        val token = preferences.getString("token", null) ?: return@withContext
        val data = request(baseUrl, "/api/home/status", token, "GET")
          .getJSONObject("data")
        val endpoint = toggleEndpoint(data, route) ?: return@withContext
        request(baseUrl, endpoint, token, "POST")
      }
    } catch (_: Exception) {
      // The refreshed widget communicates an unavailable state without crashing the host.
    } finally {
      WariatkowoWidget().update(context, glanceId)
    }
  }
}

private fun toggleEndpoint(data: JSONObject, route: String): String? {
  if (route == "szumownica") {
    val ac = data.optJSONObject("ac") ?: return null
    val action = if (ac.optString("state") == "off") "on" else "off"
    return "/api/home/ac/$action"
  }
  val lights = data.optJSONArray("lights") ?: return null
  for (index in 0 until lights.length()) {
    val light = lights.getJSONObject(index)
    if (slug(light.optString("name")) == route || slug(light.optString("id")) == route) {
      val action = if (light.optString("state") == "on") "off" else "on"
      return "/api/home/lights/${Uri.encode(light.getString("id"))}/$action"
    }
  }
  return null
}

private fun loadDevices(preferences: SharedPreferences): List<WidgetDevice> {
  val baseUrl = preferences.getString("baseUrl", null) ?: return deviceDefinitions
  val token = preferences.getString("token", null) ?: return deviceDefinitions
  return try {
    val data = request(baseUrl, "/api/home/status", token, "GET")
      .getJSONObject("data")
    val lights = data.optJSONArray("lights")
    val ac = data.optJSONObject("ac")
    deviceDefinitions.map { definition ->
      if (definition.kind == "ac") {
        definition.copy(
          state = ac?.optString("state", "unavailable") ?: "unavailable",
          available = ac?.optBoolean("available", false) ?: false,
        )
      } else {
        var match: JSONObject? = null
        if (lights != null) {
          for (index in 0 until lights.length()) {
            val light = lights.getJSONObject(index)
            if (
              slug(light.optString("name")) == definition.route ||
              slug(light.optString("id")) == definition.route
            ) {
              match = light
              break
            }
          }
        }
        definition.copy(
          id = match?.optString("id"),
          state = match?.optString("state", "unavailable") ?: "unavailable",
          available = match?.optBoolean("available", false) ?: false,
        )
      }
    }
  } catch (_: Exception) {
    deviceDefinitions
  }
}

private fun widgetPreferences(context: Context) = EncryptedSharedPreferences.create(
  context,
  "wariatkowo_widget",
  MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
  EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
  EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
)

private fun request(
  baseUrl: String,
  path: String,
  token: String,
  method: String,
): JSONObject {
  val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
  return try {
    connection.requestMethod = method
    connection.setRequestProperty("Authorization", "Bearer $token")
    connection.setRequestProperty("Accept", "application/json")
    connection.connectTimeout = 5_000
    connection.readTimeout = 5_000
    if (connection.responseCode !in 200..299) throw IllegalStateException()
    JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
  } finally {
    connection.disconnect()
  }
}

private fun slug(value: String) = Normalizer
  .normalize(value.lowercase(), Normalizer.Form.NFD)
  .replace(Regex("\\p{Mn}+"), "")
  .replace("ł", "l")
  .replace(Regex("[^a-z0-9]+"), "-")
  .trim('-')

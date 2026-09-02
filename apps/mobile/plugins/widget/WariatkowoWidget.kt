package com.wariatkowo.mobile.widget

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.*
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.layout.*
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.wariatkowo.mobile.MainActivity
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
  WidgetDevice(
    "boskie-swiatlo",
    "Boskie światło",
    "light",
    null,
    "unknown",
    false,
  ),
  WidgetDevice(
    "miskolampa",
    "Miśkolampa",
    "light",
    null,
    "unknown",
    false,
  ),
  WidgetDevice(
    "szumownica",
    "Szumownica",
    "ac",
    "ac",
    "unknown",
    false,
  ),
)

private val ConfiguredKey =
  booleanPreferencesKey("configured")

private fun deviceStateKey(route: String) =
  stringPreferencesKey("device_state_$route")

private fun deviceAvailableKey(route: String) =
  booleanPreferencesKey("device_available_$route")

private fun deviceIdKey(route: String) =
  stringPreferencesKey("device_id_$route")

private fun devicePendingKey(route: String) =
  booleanPreferencesKey("device_pending_$route")

class WariatkowoWidget : GlanceAppWidget(
  errorUiLayout = R.layout.wariatkowo_widget_fallback,
) {
  override val stateDefinition =
    PreferencesGlanceStateDefinition

  override val sizeMode = SizeMode.Responsive(
    setOf(
      DpSize(250.dp, 150.dp),
      DpSize(320.dp, 180.dp),
    ),
  )

  override suspend fun provideGlance(
    context: Context,
    id: GlanceId,
  ) {
    /*
     * Normally synchronize with the backend whenever
     * Glance asks us to rebuild the widget.
     *
     * While a toggle is pending, however, we deliberately
     * keep the optimistic state instead of immediately
     * replacing it with possibly-stale backend data.
     */
    val currentPreferences = runCatching {
      getAppWidgetState(
        context,
        PreferencesGlanceStateDefinition,
        id,
      )
    }.getOrNull()

    val hasPendingAction =
      currentPreferences?.let { preferences ->
        deviceDefinitions.any { device ->
          preferences[devicePendingKey(device.route)] == true
        }
      } ?: false

    if (!hasPendingAction) {
      runCatching {
        syncWidgetState(
          context = context,
          glanceId = id,
        )
      }
    }

    provideContent {
      val state = currentState<Preferences>()

      val configured =
        state[ConfiguredKey] ?: false

      val devices = deviceDefinitions.map { definition ->
        definition.copy(
          id = state[deviceIdKey(definition.route)]
            ?.takeIf { it.isNotBlank() }
            ?: definition.id,

          state = state[deviceStateKey(definition.route)]
            ?: definition.state,

          available =
            state[deviceAvailableKey(definition.route)]
              ?: definition.available,
        )
      }

      WidgetContent(
        devices = devices,
        configured = configured,
      )
    }
  }
}

@Composable
private fun WidgetContent(
  devices: List<WidgetDevice>,
  configured: Boolean,
) {
  val context = LocalContext.current

  val openHome = actionStartActivity(
    Intent(
      context,
      MainActivity::class.java,
    ).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse(
        "wariatkowo:///(tabs)/home",
      )
    },
  )

  Column(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(
        Color(0xFFFFF8F2),
      )
      .padding(12.dp),
  ) {
    Text(
      "Wariatkowo",
      modifier = GlanceModifier
        .fillMaxWidth()
        .clickable(openHome),
      style = TextStyle(
        color = ColorProvider(
          Color(0xFF29252E),
        ),
        fontWeight = FontWeight.Bold,
        fontSize = 19.sp,
        textAlign = TextAlign.Center,
      ),
    )

    Spacer(
      GlanceModifier.height(8.dp),
    )

    devices.forEach { device ->
      DeviceRow(
        device = device,
        configured = configured,
      )
    }
  }
}

@Composable
private fun DeviceRow(
  device: WidgetDevice,
  configured: Boolean,
) {
  val isOn =
    device.available &&
      device.state != "off"

  val stateLabel = when {
    !configured ->
      "Zaloguj się"

    !device.available ->
      "Niedostępne"

    isOn ->
      "Wł."

    else ->
      "Wył."
  }

  val toggle = actionRunCallback<ToggleAction>(
    actionParametersOf(
      DeviceKey to device.route,
    ),
  )

  Row(
    modifier = GlanceModifier
      .fillMaxWidth()
      .padding(vertical = 5.dp)
      .background(
        if (isOn) {
          Color(0x267257E8)
        } else {
          Color(0x12FFFFFF)
        },
      )
      .clickable(toggle)
      .padding(
        horizontal = 11.dp,
        vertical = 9.dp,
      ),
    verticalAlignment =
      Alignment.CenterVertically,
  ) {
    Image(
      provider = ImageProvider(
        if (device.kind == "light") {
          R.drawable.ic_widget_lightbulb
        } else {
          R.drawable.ic_widget_snowflake
        },
      ),
      contentDescription = null,
      modifier =
        GlanceModifier.size(24.dp),
    )

    Spacer(
      GlanceModifier.width(9.dp),
    )

    Text(
      device.name,
      modifier =
        GlanceModifier.defaultWeight(),
      maxLines = 1,
      style = TextStyle(
        color = ColorProvider(
          Color(0xFF29252E),
        ),
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
      ),
    )

    Text(
      stateLabel,
      style = TextStyle(
        color = ColorProvider(
          when {
            !device.available ->
              Color(0xFF827A89)

            isOn ->
              Color(0xFF4F9467)

            else ->
              Color(0xFF827A89)
          },
        ),
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
      ),
    )
  }
}

class WariatkowoWidgetReceiver :
  GlanceAppWidgetReceiver() {

  override val glanceAppWidget =
    WariatkowoWidget()
}

val DeviceKey =
  ActionParameters.Key<String>("device")

class ToggleAction : ActionCallback {

  override suspend fun onAction(
    context: Context,
    glanceId: GlanceId,
    parameters: ActionParameters,
  ) {
    val route =
      parameters[DeviceKey] ?: return

    val preferences = runCatching {
      widgetPreferences(context)
    }.getOrNull() ?: return

    val baseUrl =
      preferences.getString(
        "baseUrl",
        null,
      ) ?: return

    val token =
      preferences.getString(
        "token",
        null,
      ) ?: return

    val widgetState = runCatching {
      getAppWidgetState(
        context,
        PreferencesGlanceStateDefinition,
        glanceId,
      )
    }.getOrNull()

    val currentState =
      widgetState?.get(
        deviceStateKey(route),
      )

    val currentAvailable =
      widgetState?.get(
        deviceAvailableKey(route),
      ) ?: true

    val storedId =
      widgetState?.get(
        deviceIdKey(route),
      )

    /*
     * Normally we already know everything required
     * from Glance state, so no GET request is needed
     * before updating the UI.
     */
    val command =
      commandFromWidgetState(
        route = route,
        state = currentState,
        id = storedId,
      )
        ?: runCatching {
          withContext(Dispatchers.IO) {
            val data = request(
              baseUrl,
              "/api/home/status",
              token,
              "GET",
            ).getJSONObject("data")

            toggleEndpoint(
              data,
              route,
            )
          }
        }.getOrNull()
        ?: return

    val previousState =
      currentState
        ?: if (command.state == "on") {
          "off"
        } else {
          "on"
        }

    try {
      /*
       * Optimistic update.
       *
       * This happens BEFORE the Home Assistant
       * request, so the widget changes immediately.
       */
      updateAppWidgetState(
        context,
        glanceId,
      ) { state ->
        state[deviceStateKey(route)] =
          command.state

        state[deviceAvailableKey(route)] =
          true

        state[devicePendingKey(route)] =
          true
      }

      /*
       * Force the new Glance state onto
       * the home screen immediately.
       */
      WariatkowoWidget().update(
        context,
        glanceId,
      )

      /*
       * Perform the actual command.
       */
      withContext(Dispatchers.IO) {
        request(
          baseUrl,
          command.endpoint,
          token,
          "POST",
        )
      }

      /*
       * The action succeeded. Keep the optimistic
       * state and allow future refreshes to synchronize
       * it with the server again.
       */
      updateAppWidgetState(
        context,
        glanceId,
      ) { state ->
        state[devicePendingKey(route)] =
          false
      }

    } catch (_: Exception) {
      /*
       * Action failed: restore the visual state.
       */
      updateAppWidgetState(
        context,
        glanceId,
      ) { state ->
        state[deviceStateKey(route)] =
          previousState

        state[deviceAvailableKey(route)] =
          currentAvailable

        state[devicePendingKey(route)] =
          false
      }

      WariatkowoWidget().update(
        context,
        glanceId,
      )
    }
  }
}

private data class ToggleCommand(
  val endpoint: String,
  val state: String,
)

private fun commandFromWidgetState(
  route: String,
  state: String?,
  id: String?,
): ToggleCommand? {

  if (
    state.isNullOrBlank() ||
    state == "unknown" ||
    state == "unavailable"
  ) {
    return null
  }

  if (route == "szumownica") {
    val action =
      if (state == "off") {
        "on"
      } else {
        "off"
      }

    return ToggleCommand(
      endpoint =
        "/api/home/ac/$action",
      state = action,
    )
  }

  if (id.isNullOrBlank()) {
    return null
  }

  val action =
    if (state == "on") {
      "off"
    } else {
      "on"
    }

  return ToggleCommand(
    endpoint =
      "/api/home/lights/${
        Uri.encode(id)
      }/$action",
    state = action,
  )
}

private fun toggleEndpoint(
  data: JSONObject,
  route: String,
): ToggleCommand? {

  if (route == "szumownica") {
    val ac =
      data.optJSONObject("ac")
        ?: return null

    val action =
      if (
        ac.optString("state") == "off"
      ) {
        "on"
      } else {
        "off"
      }

    return ToggleCommand(
      endpoint =
        "/api/home/ac/$action",
      state = action,
    )
  }

  val lights =
    data.optJSONArray("lights")
      ?: return null

  for (
    index in 0 until lights.length()
  ) {
    val light =
      lights.getJSONObject(index)

    if (
      slug(
        light.optString("name"),
      ) == route ||
      slug(
        light.optString("id"),
      ) == route
    ) {
      val action =
        if (
          light.optString("state") ==
          "on"
        ) {
          "off"
        } else {
          "on"
        }

      return ToggleCommand(
        endpoint =
          "/api/home/lights/${
            Uri.encode(
              light.getString("id"),
            )
          }/$action",
        state = action,
      )
    }
  }

  return null
}

private suspend fun syncWidgetState(
  context: Context,
  glanceId: GlanceId,
) {
  val preferences =
    widgetPreferences(context)

  val configured =
    preferences.contains("token") &&
      preferences.contains("baseUrl")

  val devices =
    if (configured) {
      withContext(Dispatchers.IO) {
        loadDevices(preferences)
      }
    } else {
      deviceDefinitions
    }

  updateAppWidgetState(
    context,
    glanceId,
  ) { state ->

    state[ConfiguredKey] =
      configured

    devices.forEach { device ->

      state[
        deviceStateKey(device.route)
      ] = device.state

      state[
        deviceAvailableKey(device.route)
      ] = device.available

      state[
        deviceIdKey(device.route)
      ] = device.id ?: ""
    }
  }
}

private fun loadDevices(
  preferences: SharedPreferences,
): List<WidgetDevice> {

  val baseUrl =
    preferences.getString(
      "baseUrl",
      null,
    ) ?: return deviceDefinitions

  val token =
    preferences.getString(
      "token",
      null,
    ) ?: return deviceDefinitions

  return try {

    val data = request(
      baseUrl,
      "/api/home/status",
      token,
      "GET",
    ).getJSONObject("data")

    val lights =
      data.optJSONArray("lights")

    val ac =
      data.optJSONObject("ac")

    deviceDefinitions.map { definition ->

      if (definition.kind == "ac") {

        definition.copy(
          state =
            ac?.optString(
              "state",
              "unavailable",
            ) ?: "unavailable",

          available =
            ac?.optBoolean(
              "available",
              false,
            ) ?: false,
        )

      } else {

        var match: JSONObject? = null

        if (lights != null) {

          for (
            index in 0 until lights.length()
          ) {
            val light =
              lights.getJSONObject(
                index,
              )

            if (
              slug(
                light.optString("name"),
              ) == definition.route ||
              slug(
                light.optString("id"),
              ) == definition.route
            ) {
              match = light
              break
            }
          }
        }

        definition.copy(
          id =
            match?.optString("id"),

          state =
            match?.optString(
              "state",
              "unavailable",
            ) ?: "unavailable",

          available =
            match?.optBoolean(
              "available",
              false,
            ) ?: false,
        )
      }
    }

  } catch (_: Exception) {
    deviceDefinitions
  }
}

private fun widgetPreferences(
  context: Context,
) = EncryptedSharedPreferences.create(
  context,
  "wariatkowo_widget",

  MasterKey.Builder(context)
    .setKeyScheme(
      MasterKey.KeyScheme.AES256_GCM,
    )
    .build(),

  EncryptedSharedPreferences
    .PrefKeyEncryptionScheme
    .AES256_SIV,

  EncryptedSharedPreferences
    .PrefValueEncryptionScheme
    .AES256_GCM,
)

private fun request(
  baseUrl: String,
  path: String,
  token: String,
  method: String,
): JSONObject {

  val connection =
    URL(
      baseUrl.trimEnd('/') + path,
    ).openConnection()
      as HttpURLConnection

  return try {

    connection.requestMethod =
      method

    connection.setRequestProperty(
      "Authorization",
      "Bearer $token",
    )

    connection.setRequestProperty(
      "Accept",
      "application/json",
    )

    connection.connectTimeout =
      5_000

    connection.readTimeout =
      5_000

    if (
      connection.responseCode
        !in 200..299
    ) {
      throw IllegalStateException()
    }

    val body =
      connection.inputStream
        .bufferedReader()
        .use {
          it.readText()
        }
        .trim()

    if (body.isEmpty()) {
      JSONObject()
    } else {
      JSONObject(body)
    }

  } finally {
    connection.disconnect()
  }
}

private fun slug(
  value: String,
) = Normalizer
  .normalize(
    value.lowercase(),
    Normalizer.Form.NFD,
  )
  .replace(
    Regex("\\p{Mn}+"),
    "",
  )
  .replace(
    "ł",
    "l",
  )
  .replace(
    Regex("[^a-z0-9]+"),
    "-",
  )
  .trim('-')
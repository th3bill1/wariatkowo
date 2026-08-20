package com.wariatkowo.mobile.widget
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.glance.*
import androidx.glance.action.*
import androidx.glance.appwidget.*
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.updateAll
import androidx.glance.layout.*
import androidx.glance.text.*
import androidx.glance.unit.ColorProvider
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
data class Device(val route:String,val name:String,val kind:String,val id:String?,val state:String)
class WariatkowoWidget:GlanceAppWidget(){override val sizeMode=SizeMode.Responsive(setOf(androidx.compose.ui.unit.DpSize(250.dp,110.dp),androidx.compose.ui.unit.DpSize(320.dp,160.dp)));override suspend fun provideGlance(context:Context,id:GlanceId){provideContent{WidgetContent()}};@Composable private fun WidgetContent(){val devices=listOf(Device("boskie-swiatlo","Boskie światło","light",null,"unknown"),Device("miskolampa","Miśkolampa","light",null,"unknown"),Device("szumownica","Szumownica","ac","ac","unknown"));Column(modifier=GlanceModifier.fillMaxSize().background(ColorProvider(android.graphics.Color.rgb(255,248,238))).padding(12.dp)){Text("Wariatkowo",style=TextStyle(fontWeight=FontWeight.Bold,fontSize=18.sp));devices.forEach{d->Row(modifier=GlanceModifier.fillMaxWidth().padding(vertical=3.dp),verticalAlignment=Alignment.CenterVertically){Text(d.name,modifier=GlanceModifier.defaultWeight(),maxLines=1);Button(if(d.kind=="light")"💡 WŁ./WYŁ." else "❄ WŁ./WYŁ.",onClick=actionRunCallback<ToggleAction>(actionParametersOf(DeviceKey to d.route)));Button("›",onClick=actionStartActivity(Intent(Intent.ACTION_VIEW,Uri.parse("wariatkowo://devices/${d.route}"))))}}}}
}
class WariatkowoWidgetReceiver:GlanceAppWidgetReceiver(){override val glanceAppWidget=WariatkowoWidget()}
val DeviceKey=ActionParameters.Key<String>("device")
class ToggleAction:ActionCallback{override suspend fun onAction(context:Context,glanceId:GlanceId,parameters:ActionParameters){val route=parameters[DeviceKey]?:return;val p=prefs(context);val base=p.getString("baseUrl",null)?:return;val token=p.getString("token",null)?:return;try{val status=get(base,"/api/home/status",token);val data=status.getJSONObject("data");val endpoint=if(route=="szumownica"){val ac=data.optJSONObject("ac")?:return;"/api/home/ac/${if(ac.optString("state")=="off")"on" else "off"}"}else{val lights=data.getJSONArray("lights");var id:String?=null;var on=false;for(i in 0 until lights.length()){val x=lights.getJSONObject(i);val slug=slug(x.optString("name"));if(slug==route||slug(x.optString("id"))==route){id=x.getString("id");on=x.optString("state")=="on";break}};if(id==null)return;"/api/home/lights/${Uri.encode(id)}/${if(on)"off" else "on"}"};post(base,endpoint,token);get(base,"/api/home/status",token)}catch(_:Exception){}finally{WariatkowoWidget().update(context,glanceId)}}}
private fun prefs(c:Context)=EncryptedSharedPreferences.create(c,"wariatkowo_widget",MasterKey.Builder(c).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
private fun request(base:String,path:String,token:String,method:String):JSONObject{val c=URL(base.trimEnd('/')+path).openConnection()as HttpURLConnection;c.requestMethod=method;c.setRequestProperty("Authorization","Bearer $token");c.setRequestProperty("Accept","application/json");c.connectTimeout=5000;c.readTimeout=5000;if(c.responseCode !in 200..299)throw IllegalStateException();return JSONObject(c.inputStream.bufferedReader().readText())}
private fun get(b:String,p:String,t:String)=request(b,p,t,"GET");private fun post(b:String,p:String,t:String)=request(b,p,t,"POST");private fun slug(v:String)=java.text.Normalizer.normalize(v.lowercase(),java.text.Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"),"").replace("ł","l").replace(Regex("[^a-z0-9]+"),"-").trim('-')

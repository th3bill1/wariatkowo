import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import type { HomeClimate, HomeLight, HomeStatus } from "../../../../shared/models";
import { findWidgetLightId } from "@wariatkowo/api-client/src/deviceRoutes";
import { useAuth } from "../../src/AuthProvider";
import { Button, Card, State, Title, s } from "../../src/ui";

export default function Device() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { try { setStatus(await api.home.status()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Błąd"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [id]);
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { Alert.alert("Nie udało się sterować", e instanceof Error ? e.message : ""); } };
  const lightId = id && status ? findWidgetLightId(status.lights, id) : null;
  const light: HomeLight | undefined = status?.lights.find((x) => x.id === lightId);
  if (id === "szumownica" && status?.ac) return <Climate climate={status.ac} run={run} />;
  return <ScrollView contentContainerStyle={s.screen}><Title subtitle="Pełne ustawienia światła.">{light?.name ?? "Urządzenie"}</Title><State loading={loading} error={error}/>{light ? <Card><Text style={s.label}>💡 {light.state === "on" ? "Włączone" : "Wyłączone"}</Text><Button title={light.state === "on" ? "Wyłącz" : "Włącz"} onPress={() => void run(() => api.home.lightPower(light.id, light.state !== "on"))}/>{light.supportsBrightness ? <><Text>Jasność: {light.brightness ?? 100}%</Text><View style={s.row}><Button secondary title="− 10" onPress={() => void run(() => api.home.lightSettings(light.id, { brightness: Math.max(1, (light.brightness ?? 100) - 10) }))}/><Button secondary title="+ 10" onPress={() => void run(() => api.home.lightSettings(light.id, { brightness: Math.min(100, (light.brightness ?? 100) + 10) }))}/></View></> : null}{light.supportsColorTemperature ? <><Text>Barwa: {light.colorTemperatureKelvin ?? 4000} K</Text><View style={s.row}><Button secondary title="Cieplej" onPress={() => void run(() => api.home.lightSettings(light.id, { colorTemperatureKelvin: Math.max(light.minColorTemperatureKelvin ?? 2000, (light.colorTemperatureKelvin ?? 4000) - 250) }))}/><Button secondary title="Chłodniej" onPress={() => void run(() => api.home.lightSettings(light.id, { colorTemperatureKelvin: Math.min(light.maxColorTemperatureKelvin ?? 6500, (light.colorTemperatureKelvin ?? 4000) + 250) }))}/></View></> : null}</Card> : !loading ? <Text style={s.error}>To urządzenie nie jest skonfigurowane na serwerze.</Text> : null}</ScrollView>;
}
function Climate({ climate, run }: { climate: HomeClimate; run(fn: () => Promise<unknown>): Promise<void> }) {
  const { api } = useAuth(); const on = climate.state !== "off"; const target = climate.targetTemperature ?? climate.minTemperature;
  return <ScrollView contentContainerStyle={s.screen}><Title subtitle="Temperatura, nawiew i dodatkowe funkcje.">Szumownica</Title><Card><Text style={s.label}>❄️ {on ? "Włączona" : "Wyłączona"}</Text><Text style={s.meta}>W pokoju: {climate.currentTemperature ?? "—"}°C</Text><Button title={on ? "Wyłącz" : "Włącz"} onPress={() => void run(() => api.home.acPower(!on))}/><Text>Temperatura: {target}°C</Text><View style={s.row}><Button secondary title="−" onPress={() => void run(() => api.home.acTemperature(Math.max(climate.minTemperature, target - climate.temperatureStep)))}/><Button secondary title="+" onPress={() => void run(() => api.home.acTemperature(Math.min(climate.maxTemperature, target + climate.temperatureStep)))}/></View></Card>{climate.modes.length ? <Card><Text style={s.label}>Tryb</Text>{climate.modes.map((x) => <Button key={x} secondary={x !== climate.state} title={x} onPress={() => void run(() => api.home.acMode(x))}/>)}</Card> : null}{climate.fanModes.length ? <Card><Text style={s.label}>Nawiew</Text>{climate.fanModes.map((x) => <Button key={x} secondary={x !== climate.fanMode} title={x} onPress={() => void run(() => api.home.acFan(x))}/>)}</Card> : null}{climate.switches.map((x) => <Card key={x.id}><Text style={s.label}>{x.name}</Text><Button title={x.state === "on" ? "Wyłącz" : "Włącz"} onPress={() => void run(() => api.home.acSwitch(x.id, x.state !== "on"))}/></Card>)}</ScrollView>;
}

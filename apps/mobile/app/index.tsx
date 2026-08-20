import { Redirect } from "expo-router"; import { ActivityIndicator, View } from "react-native"; import { useAuth } from "../src/AuthProvider";
export default function Index() { const { member, loading } = useAuth(); return loading ? <View style={{flex:1,justifyContent:"center"}}><ActivityIndicator/></View> : <Redirect href={member ? "/(tabs)" : "/login"}/>; }

// app/_layout.tsx
import { Stack } from 'expo-router';
import { View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Espaciador para Android edge-to-edge (evita warning del StatusBar) */}
      <View
        style={{
          height: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
          backgroundColor: '#000',
        }}
      />
      {/* Importante: NO pasar style al <Stack/>; envolver en un <View> */}
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>

      {/* StatusBar sin backgroundColor directo */}
      <StatusBar style="light" translucent />
    </SafeAreaProvider>
  );
}

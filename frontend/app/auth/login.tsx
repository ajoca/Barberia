import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/** ========= URL del backend (FORZADA PARA PRUEBA) ========= */

const API_URL = 'http://192.168.1.7:4000';
console.log('API_URL (FORZADA) =>', API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!API_URL) {
      Alert.alert('Config', 'API_URL no está definida');
      return;
    }
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu teléfono y contraseña');
      return;
    }

    setLoading(true);
    try {
      // --- TEST de red antes del login ---
      const healthURL = `${API_URL}/api/health`;
      console.log('HEALTH =>', healthURL);

      try {
        const r1 = await fetch(healthURL);
        console.log('fetch /health OK', await r1.text());
      } catch (e) {
        console.log('fetch /health FAIL', e);
      }

      try {
        const r2 = await api.get('/api/health');
        console.log('axios /health OK', r2.data);
      } catch (e: any) {
        console.log('axios /health FAIL', e?.message, e?.response?.status, e?.response?.data);
      }
      // --- fin TEST ---

      console.log('POST =>', `${API_URL}/api/auth/login`);
      const response = await api.post(
        '/api/auth/login',
        { phone: phone.trim(), password: password.trim() },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { access_token, user } = response.data;
      await AsyncStorage.setItem('access_token', access_token);
      await AsyncStorage.setItem('user_data', JSON.stringify(user));

      Alert.alert('Éxito', 'Inicio de sesión exitoso', [
        {
          text: 'OK',
          onPress: () => {
            switch (user.role) {
              case 'admin':  router.replace('/admin/dashboard');  break;
              case 'barber': router.replace('/barber/dashboard'); break;
              case 'client': router.replace('/client/dashboard'); break;
              default:       router.replace('/');
            }
          },
        },
      ]);
    } catch (error: any) {
      if (error?.response) {
        console.log('HTTP', error.response.status, error.response.data);
        const message = error.response.data?.detail ?? `Error HTTP ${error.response.status}`;
        Alert.alert('Error', message);
      } else if (error?.request) {
        console.log('NETWORK', error.message, error.config?.baseURL, error.config?.url);
        Alert.alert('Red', 'No se pudo contactar al servidor');
      } else {
        console.log('SETUP', error?.message);
        Alert.alert('Error', error?.message ?? 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoToRegister = () => router.push('/auth/register');
  const handleGoBack = () => router.back();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{
        height: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
        backgroundColor: '#0A0A0A'
      }} />
      <RNStatusBar barStyle="light-content" translucent />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Ionicons name="arrow-back" size={24} color="#D4AF37" />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Ionicons name="cut" size={32} color="#D4AF37" />
              <Text style={styles.logoText}>ELITE</Text>
            </View>
          </View>
          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Iniciar Sesión</Text>
            <Text style={styles.subtitle}>Ingresa a tu cuenta</Text>
            {/* Phone */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="call" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Número de teléfono"
                  placeholderTextColor="#666"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
            </View>
            {/* Password */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Submit */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0A0A0A" />
              ) : (
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              )}
            </TouchableOpacity>
            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>
            {/* Register */}
            <TouchableOpacity style={styles.registerButton} onPress={handleGoToRegister}>
              <Text style={styles.registerButtonText}>Crear Nueva Cuenta</Text>
            </TouchableOpacity>
            {/* Demo */}
            <View style={styles.demoContainer}>
              <Text style={styles.demoTitle}>Cuentas de prueba:</Text>
              <Text style={styles.demoText}>Admin: +1234567890 / admin123</Text>
              <Text style={styles.demoText}>Cliente: Registra una nueva cuenta</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40, // Compensate for back button
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    letterSpacing: 2,
    marginTop: 4,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  loginButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    color: '#666666',
    marginHorizontal: 16,
    fontSize: 14,
  },
  registerButton: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  demoContainer: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  demoTitle: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  demoText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginBottom: 4,
  },
});
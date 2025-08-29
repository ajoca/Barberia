import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WhatsAppStatus {
  connected: boolean;
  phone_number?: string;
  qr_code?: string;
  session_active: boolean;
}

interface WhatsAppMessage {
  id: string;
  to_phone: string;
  message: string;
  template_type: string;
  status: string;
  appointment_id?: string;
  sent_at?: string;
  created_at: string;
}

export default function WhatsAppScreen() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    session_active: false,
  });
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWhatsAppData();
  }, []);

  const loadWhatsAppData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load WhatsApp status
      const statusResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/whatsapp/status`, {
        headers,
      });
      const statusData = await statusResponse.json();
      setStatus(statusData);

      // Load recent messages
      const messagesResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/whatsapp/messages?limit=20`, {
        headers,
      });
      const messagesData = await messagesResponse.json();
      setMessages(messagesData);

    } catch (error) {
      console.error('Error loading WhatsApp data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de WhatsApp');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWhatsAppData();
  };

  const handleReconnect = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/whatsapp/reconnect`, {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Reconexión iniciada. Por favor espera unos segundos y actualiza.');
        setTimeout(() => loadWhatsAppData(), 3000);
      } else {
        Alert.alert('Error', 'No se pudo iniciar la reconexión');
      }
    } catch (error) {
      console.error('Error reconnecting WhatsApp:', error);
      Alert.alert('Error', 'No se pudo reconectar WhatsApp');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (messageStatus: string) => {
    switch (messageStatus) {
      case 'sent': return '#4CAF50';
      case 'failed': return '#F44336';
      case 'pending': return '#FF9800';
      default: return '#888888';
    }
  };

  const getStatusText = (messageStatus: string) => {
    switch (messageStatus) {
      case 'sent': return 'Enviado';
      case 'failed': return 'Falló';
      case 'pending': return 'Pendiente';
      default: return 'Desconocido';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando WhatsApp...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'WhatsApp Business',
          headerStyle: { backgroundColor: '#1A1A1A' },
          headerTintColor: '#D4AF37',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Conexión</Text>
          <View style={[styles.statusCard, { borderLeftColor: status.connected ? '#4CAF50' : '#F44336' }]}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>WhatsApp Business</Text>
              <Text style={[styles.statusValue, { color: status.connected ? '#4CAF50' : '#F44336' }]}>
                {status.connected ? 'Conectado' : 'Desconectado'}
              </Text>
              {status.phone_number && (
                <Text style={styles.phoneNumber}>📱 {status.phone_number}</Text>
              )}
            </View>
            <View style={styles.statusActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.connectButton]}
                onPress={handleReconnect}
              >
                <Text style={styles.actionButtonText}>
                  {status.connected ? 'Reconectar' : 'Conectar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Messages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mensajes Recientes</Text>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay mensajes enviados</Text>
              <Text style={styles.emptySubtext}>
                Los mensajes enviados a través de WhatsApp aparecerán aquí
              </Text>
            </View>
          ) : (
            <View style={styles.messagesList}>
              {messages.map((message, index) => (
                <View key={index} style={styles.messageCard}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.messagePhone}>📱 {message.to_phone}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(message.status) }]}>
                      <Text style={styles.statusBadgeText}>{getStatusText(message.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.messageType}>Tipo: {message.template_type}</Text>
                  <Text style={styles.messageDate}>{formatDate(message.created_at)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 Información</Text>
            <Text style={styles.infoText}>
              • Los mensajes se envían automáticamente cuando se confirman citas{'\n'}
              • Solo los administradores pueden gestionar la conexión de WhatsApp{'\n'}
              • La conexión debe mantenerse activa para envío automático
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phoneNumber: {
    color: '#888888',
    fontSize: 12,
  },
  statusActions: {
    marginLeft: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
  messagesList: {
    gap: 12,
  },
  messageCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messagePhone: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  messageType: {
    color: '#D4AF37',
    fontSize: 12,
    marginBottom: 4,
  },
  messageDate: {
    color: '#888888',
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: '#1A2D1A',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
});
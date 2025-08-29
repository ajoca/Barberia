import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Appointment {
  id: string;
  client_name: string;
  barber_name: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  total_price: number;
  duration_minutes: number;
}

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(response.data);
    } catch (error: any) {
      console.error('Error loading appointments:', error);
      const message = error.response?.data?.detail || 'Error al cargar citas';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['access_token', 'user_data']);
            router.replace('/');
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'confirmed':
        return '#10B981';
      case 'completed':
        return '#8B5CF6';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getTodayAppointments = () => {
    const today = new Date().toDateString();
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.scheduled_at).toDateString();
      return appointmentDate === today;
    });
  };

  const getWeekRevenue = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return appointments
      .filter(appointment => {
        const appointmentDate = new Date(appointment.scheduled_at);
        return appointmentDate >= weekAgo && appointment.status === 'completed';
      })
      .reduce((total, appointment) => total + appointment.total_price, 0);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  const todayAppointments = getTodayAppointments();
  const weekRevenue = getWeekRevenue();

  return (
    <SafeAreaView style={styles.container}>
      <View style={{
        height: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
        backgroundColor: '#0A0A0A'
      }} />
      <RNStatusBar barStyle="light-content" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Panel Admin</Text>
          <Text style={styles.subtitleText}>Elite Barbershop</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{todayAppointments.length}</Text>
            <Text style={styles.statLabel}>Citas Hoy</Text>
            <Ionicons name="calendar-outline" size={20} color="#D4AF37" />
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>${weekRevenue}</Text>
            <Text style={styles.statLabel}>Ingresos 7 días</Text>
            <Ionicons name="trending-up-outline" size={20} color="#10B981" />
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{appointments.length}</Text>
            <Text style={styles.statLabel}>Total Citas</Text>
            <Ionicons name="stats-chart-outline" size={20} color="#8B5CF6" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Gestión</Text>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/admin/appointments' })}
            >
              <Ionicons name="calendar-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Citas</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/admin/services' })}
            >
              <Ionicons name="list-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Servicios</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/admin/barbers' })}
            >
              <Ionicons name="people-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Barberos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/admin/analytics' })}
            >
              <Ionicons name="stats-chart-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Analíticas</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/admin/whatsapp' })}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={styles.appointmentsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Citas de Hoy</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/admin/appointments' })}>
              <Text style={styles.viewAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={48} color="#666666" />
              <Text style={styles.emptyText}>No hay citas programadas para hoy</Text>
            </View>
          ) : (
            todayAppointments.slice(0, 5).map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.clientName}>{appointment.client_name}</Text>
                  <Text style={styles.serviceInfo}>
                    {appointment.service_name} • {appointment.barber_name}
                  </Text>
                  <Text style={styles.appointmentTime}>
                    {formatDate(appointment.scheduled_at)} • ${appointment.total_price}
                  </Text>
                </View>
                
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(appointment.status) }]} />
              </View>
            ))
          )}
        </View>

        {/* Recent Activity Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Citas Pendientes</Text>
              <Text style={styles.summaryValue}>
                {appointments.filter(a => a.status === 'pending').length}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Citas Confirmadas</Text>
              <Text style={styles.summaryValue}>
                {appointments.filter(a => a.status === 'confirmed').length}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Citas Completadas</Text>
              <Text style={styles.summaryValue}>
                {appointments.filter(a => a.status === 'completed').length}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  subtitleText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appointmentsContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
  appointmentCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  serviceInfo: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 12,
    color: '#666666',
  },
  statusIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
  summaryContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
});
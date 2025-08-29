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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
}

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

export default function BarberDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
    loadAppointments();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

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

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/appointments/${appointmentId}/status?status=${status}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Éxito', 'Estado actualizado correctamente');
      loadAppointments();
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      const message = error.response?.data?.detail || 'Error al actualizar cita';
      Alert.alert('Error', message);
    }
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

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments
      .filter(appointment => {
        const appointmentDate = new Date(appointment.scheduled_at);
        return appointmentDate > now && (appointment.status === 'pending' || appointment.status === 'confirmed');
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
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
  const upcomingAppointments = getUpcomingAppointments();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hola, {user?.name}</Text>
          <Text style={styles.subtitleText}>Panel de Barbero</Text>
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
            <Text style={styles.statNumber}>{upcomingAppointments.length}</Text>
            <Text style={styles.statLabel}>Próximas</Text>
            <Ionicons name="time-outline" size={20} color="#10B981" />
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {appointments.filter(a => a.status === 'completed').length}
            </Text>
            <Text style={styles.statLabel}>Completadas</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color="#8B5CF6" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/barber/schedule')}
            >
              <Ionicons name="calendar-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Mi Horario</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/barber/appointments')}
            >
              <Ionicons name="list-outline" size={24} color="#D4AF37" />
              <Text style={styles.actionText}>Mis Citas</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={styles.appointmentsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Citas de Hoy</Text>
            <TouchableOpacity onPress={() => router.push('/barber/appointments')}>
              <Text style={styles.viewAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={48} color="#666666" />
              <Text style={styles.emptyText}>No tienes citas programadas para hoy</Text>
            </View>
          ) : (
            todayAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.clientName}>{appointment.client_name}</Text>
                  <Text style={styles.serviceInfo}>{appointment.service_name}</Text>
                  <Text style={styles.appointmentTime}>
                    {formatDate(appointment.scheduled_at)} • ${appointment.total_price}
                  </Text>
                </View>
                
                <View style={styles.appointmentActions}>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(appointment.status) }]} />
                  
                  {appointment.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  
                  {appointment.status === 'confirmed' && (
                    <TouchableOpacity
                      style={styles.completeButton}
                      onPress={() => updateAppointmentStatus(appointment.id, 'completed')}
                    >
                      <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.upcomingContainer}>
          <Text style={styles.sectionTitle}>Próximas Citas</Text>
          
          {upcomingAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color="#666666" />
              <Text style={styles.emptyText}>No tienes próximas citas programadas</Text>
            </View>
          ) : (
            upcomingAppointments.slice(0, 3).map((appointment) => (
              <View key={appointment.id} style={styles.upcomingCard}>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingClient}>{appointment.client_name}</Text>
                  <Text style={styles.upcomingService}>{appointment.service_name}</Text>
                  <Text style={styles.upcomingTime}>
                    {formatDate(appointment.scheduled_at)}
                  </Text>
                </View>
                
                <View style={styles.upcomingPrice}>
                  <Text style={styles.priceText}>${appointment.total_price}</Text>
                </View>
              </View>
            ))
          )}
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
    color: '#FFFFFF',
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
    gap: 12,
    marginTop: 16,
  },
  actionCard: {
    flex: 1,
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
  appointmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
  confirmButton: {
    backgroundColor: '#10B981',
    padding: 8,
    borderRadius: 6,
  },
  completeButton: {
    backgroundColor: '#8B5CF6',
    padding: 8,
    borderRadius: 6,
  },
  upcomingContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  upcomingCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingClient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upcomingService: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  upcomingTime: {
    fontSize: 12,
    color: '#666666',
  },
  upcomingPrice: {
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
});
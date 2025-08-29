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

interface Appointment {
  id: string;
  client_name: string;
  barber_name: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  total_price: number;
  duration_minutes: number;
  notes?: string;
}

export default function ClientAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('upcoming');

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

  const handleCancelAppointment = (appointment: Appointment) => {
    Alert.alert(
      'Cancelar Cita',
      `¿Estás seguro de que quieres cancelar tu cita de ${appointment.service_name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: () => cancelAppointment(appointment.id),
        },
      ]
    );
  };

  const cancelAppointment = async (appointmentId: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/appointments/${appointmentId}/status`,
        { status: 'cancelled' },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Éxito', 'Cita cancelada correctamente');
      loadAppointments();
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      const message = error.response?.data?.detail || 'Error al cancelar cita';
      Alert.alert('Error', message);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'confirmed':
        return 'Confirmada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    
    switch (filter) {
      case 'upcoming':
        return appointments.filter(appointment => 
          new Date(appointment.scheduled_at) > now &&
          (appointment.status === 'pending' || appointment.status === 'confirmed')
        );
      case 'past':
        return appointments.filter(appointment => 
          new Date(appointment.scheduled_at) < now ||
          appointment.status === 'completed' ||
          appointment.status === 'cancelled'
        );
      case 'completed':
        return appointments.filter(appointment => appointment.status === 'completed');
      case 'cancelled':
        return appointments.filter(appointment => appointment.status === 'cancelled');
      default:
        return appointments;
    }
  };

  const getStatsForFilter = (filterType: string) => {
    const now = new Date();
    
    switch (filterType) {
      case 'upcoming':
        return appointments.filter(appointment => 
          new Date(appointment.scheduled_at) > now &&
          (appointment.status === 'pending' || appointment.status === 'confirmed')
        ).length;
      case 'completed':
        return appointments.filter(appointment => appointment.status === 'completed').length;
      case 'cancelled':
        return appointments.filter(appointment => appointment.status === 'cancelled').length;
      case 'total':
        return appointments.length;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Cargando citas...</Text>
      </SafeAreaView>
    );
  }

  const filteredAppointments = getFilteredAppointments();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Citas</Text>
        <TouchableOpacity onPress={() => router.push('/client/book-appointment')}>
          <Ionicons name="add-circle" size={24} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForFilter('total')}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForFilter('upcoming')}</Text>
          <Text style={styles.statLabel}>Próximas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForFilter('completed')}</Text>
          <Text style={styles.statLabel}>Completadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForFilter('cancelled')}</Text>
          <Text style={styles.statLabel}>Canceladas</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            {[
              { key: 'upcoming', label: 'Próximas' },
              { key: 'past', label: 'Pasadas' },
              { key: 'completed', label: 'Completadas' },
              { key: 'cancelled', label: 'Canceladas' },
              { key: 'all', label: 'Todas' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  filter === tab.key && styles.filterTabActive,
                ]}
                onPress={() => setFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === tab.key && styles.filterTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Appointments List */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#666666" />
            <Text style={styles.emptyText}>No hay citas</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'upcoming' ? '¡Agenda tu primera cita!' : 
               filter === 'past' ? 'No tienes citas pasadas' :
               filter === 'completed' ? 'No hay citas completadas' :
               filter === 'cancelled' ? 'No hay citas canceladas' :
               'Aún no has agendado citas'}
            </Text>
            
            {filter === 'upcoming' && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/client/book-appointment')}
              >
                <Text style={styles.emptyButtonText}>Agendar Cita</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.appointmentsContainer}>
            {filteredAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                {/* Appointment Header */}
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.serviceName}>{appointment.service_name}</Text>
                    <Text style={styles.barberName}>con {appointment.barber_name}</Text>
                  </View>
                  
                  <View style={styles.appointmentMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
                    </View>
                    <Text style={styles.priceText}>${appointment.total_price}</Text>
                  </View>
                </View>

                {/* Appointment Details */}
                <View style={styles.appointmentDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#B0B0B0" />
                    <Text style={styles.detailText}>{formatDate(appointment.scheduled_at)}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#B0B0B0" />
                    <Text style={styles.detailText}>
                      {formatTime(appointment.scheduled_at)} ({appointment.duration_minutes} min)
                    </Text>
                  </View>

                  {appointment.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="chatbubble-outline" size={16} color="#B0B0B0" />
                      <Text style={styles.detailText}>{appointment.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                  {(appointment.status === 'pending' || appointment.status === 'confirmed') && 
                   new Date(appointment.scheduled_at) > new Date() && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => handleCancelAppointment(appointment)}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  )}

                  {appointment.status === 'completed' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rebookButton]}
                      onPress={() => router.push('/client/book-appointment')}
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Reagendar</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButton, styles.detailsButton]}
                    onPress={() => {
                      Alert.alert(
                        'Detalles de la Cita',
                        `Servicio: ${appointment.service_name}\nBarbero: ${appointment.barber_name}\nFecha: ${formatDate(appointment.scheduled_at)}\nHora: ${formatTime(appointment.scheduled_at)}\nDuración: ${appointment.duration_minutes} minutos\nPrecio: $${appointment.total_price}\nEstado: ${getStatusText(appointment.status)}${appointment.notes ? `\nNotas: ${appointment.notes}` : ''}`
                      );
                    }}
                  >
                    <Ionicons name="information-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Detalles</Text>
                  </TouchableOpacity>
                </View>

                {/* Special Status Messages */}
                {appointment.status === 'pending' && (
                  <View style={styles.statusMessage}>
                    <Ionicons name="hourglass-outline" size={16} color="#F59E0B" />
                    <Text style={styles.statusMessageText}>
                      Esperando confirmación del barbero
                    </Text>
                  </View>
                )}

                {appointment.status === 'confirmed' && new Date(appointment.scheduled_at) > new Date() && (
                  <View style={styles.statusMessage}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.statusMessageText}>
                      Cita confirmada. Recibirás recordatorio por WhatsApp
                    </Text>
                  </View>
                )}

                {appointment.status === 'completed' && (
                  <View style={styles.statusMessage}>
                    <Ionicons name="star" size={16} color="#D4AF37" />
                    <Text style={styles.statusMessageText}>
                      ¡Esperamos que hayas disfrutado tu servicio!
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        {appointments.length > 0 && (
          <View style={styles.quickActionsContainer}>
            <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/client/book-appointment')}
            >
              <Ionicons name="add-circle" size={24} color="#D4AF37" />
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Nueva Cita</Text>
                <Text style={styles.quickActionSubtitle}>Agenda otro servicio</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="call" size={24} color="#D4AF37" />
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Contactar Barbería</Text>
                <Text style={styles.quickActionSubtitle}>Llama para consultas</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <Ionicons name="star" size={24} color="#D4AF37" />
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Calificar Servicio</Text>
                <Text style={styles.quickActionSubtitle}>Comparte tu experiencia</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
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
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  statLabel: {
    fontSize: 10,
    color: '#B0B0B0',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: '#D4AF37',
  },
  filterTabText: {
    fontSize: 12,
    color: '#B0B0B0',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#0A0A0A',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  appointmentsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  appointmentCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appointmentInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  barberName: {
    fontSize: 14,
    color: '#D4AF37',
  },
  appointmentMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  appointmentDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#B0B0B0',
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  rebookButton: {
    backgroundColor: '#10B981',
  },
  detailsButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2A2A2A',
    padding: 8,
    borderRadius: 6,
  },
  statusMessageText: {
    fontSize: 12,
    color: '#B0B0B0',
    flex: 1,
  },
  quickActionsContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  quickActionCard: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#B0B0B0',
  },
});
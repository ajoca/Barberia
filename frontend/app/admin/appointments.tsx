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

export default function AdminAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

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

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(
        `${API_URL}/api/appointments/${appointmentId}/status`,
        { status },
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

  const handleStatusChange = (appointment: Appointment, newStatus: string) => {
    Alert.alert(
      'Confirmar Cambio',
      `¿Cambiar el estado de la cita a ${getStatusText(newStatus)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => updateAppointmentStatus(appointment.id, newStatus),
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
    if (filter === 'all') return appointments;
    return appointments.filter(appointment => appointment.status === filter);
  };

  const getStatsForStatus = (status: string) => {
    return appointments.filter(appointment => appointment.status === status).length;
  };

  const getTodaysAppointments = () => {
    const today = new Date().toDateString();
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.scheduled_at).toDateString();
      return appointmentDate === today;
    });
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
  const todaysAppointments = getTodaysAppointments();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Citas</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todaysAppointments.length}</Text>
          <Text style={styles.statLabel}>Hoy</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForStatus('pending')}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForStatus('confirmed')}</Text>
          <Text style={styles.statLabel}>Confirmadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{getStatsForStatus('completed')}</Text>
          <Text style={styles.statLabel}>Completadas</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterTabs}>
            {[
              { key: 'all', label: 'Todas', count: appointments.length },
              { key: 'pending', label: 'Pendientes', count: getStatsForStatus('pending') },
              { key: 'confirmed', label: 'Confirmadas', count: getStatsForStatus('confirmed') },
              { key: 'completed', label: 'Completadas', count: getStatsForStatus('completed') },
              { key: 'cancelled', label: 'Canceladas', count: getStatsForStatus('cancelled') },
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
                  {tab.label} ({tab.count})
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
              {filter === 'all' ? 'Aún no se han agendado citas' : `No hay citas ${getStatusText(filter).toLowerCase()}`}
            </Text>
          </View>
        ) : (
          <View style={styles.appointmentsContainer}>
            {filteredAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                {/* Appointment Header */}
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.clientName}>{appointment.client_name}</Text>
                    <Text style={styles.serviceInfo}>
                      {appointment.service_name} • {appointment.barber_name}
                    </Text>
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
                    <Text style={styles.detailText}>
                      {formatDate(appointment.scheduled_at)} - {formatTime(appointment.scheduled_at)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#B0B0B0" />
                    <Text style={styles.detailText}>{appointment.duration_minutes} minutos</Text>
                  </View>

                  {appointment.notes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="chatbubble-outline" size={16} color="#B0B0B0" />
                      <Text style={styles.detailText}>{appointment.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                  <View style={styles.actionsContainer}>
                    {appointment.status === 'pending' && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.confirmButton]}
                          onPress={() => handleStatusChange(appointment, 'confirmed')}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton]}
                          onPress={() => handleStatusChange(appointment, 'cancelled')}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {appointment.status === 'confirmed' && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.completeButton]}
                          onPress={() => handleStatusChange(appointment, 'completed')}
                        >
                          <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Completar</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton]}
                          onPress={() => handleStatusChange(appointment, 'cancelled')}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              </View>
            ))}
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
  placeholder: {
    width: 24,
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
  },
  appointmentsContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 40,
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
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  serviceInfo: {
    fontSize: 14,
    color: '#B0B0B0',
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
  confirmButton: {
    backgroundColor: '#10B981',
  },
  completeButton: {
    backgroundColor: '#8B5CF6',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
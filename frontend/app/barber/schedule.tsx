import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BarberProfile {
  id: string;
  name: string;
  specialties: string[];
  bio: string;
  schedule: Record<string, { start: string; end: string }>;
}

interface DaySchedule {
  start: string;
  end: string;
  active: boolean;
}

export default function BarberScheduleScreen() {
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDay, setEditingDay] = useState<string>('');
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({
    monday: { start: '09:00', end: '18:00', active: false },
    tuesday: { start: '09:00', end: '18:00', active: false },
    wednesday: { start: '09:00', end: '18:00', active: false },
    thursday: { start: '09:00', end: '18:00', active: false },
    friday: { start: '09:00', end: '18:00', active: false },
    saturday: { start: '09:00', end: '15:00', active: false },
    sunday: { start: '10:00', end: '14:00', active: false },
  });

  const dayTranslations: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  useEffect(() => {
    loadBarberProfile();
  }, []);

  const loadBarberProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userData = await AsyncStorage.getItem('user_data');
      const user = userData ? JSON.parse(userData) : null;

      // Get barber profile
      const barbersResponse = await axios.get(`${API_URL}/api/barbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userBarber = barbersResponse.data.find((barber: any) => barber.user_id === user.id);
      
      if (userBarber) {
        setBarberProfile(userBarber);
        
        // Convert schedule format
        const convertedSchedule: Record<string, DaySchedule> = {};
        Object.keys(schedule).forEach(day => {
          if (userBarber.schedule[day]) {
            convertedSchedule[day] = {
              start: userBarber.schedule[day].start,
              end: userBarber.schedule[day].end,
              active: true,
            };
          } else {
            convertedSchedule[day] = {
              start: schedule[day].start,
              end: schedule[day].end,
              active: false,
            };
          }
        });
        setSchedule(convertedSchedule);
      }
    } catch (error: any) {
      console.error('Error loading barber profile:', error);
      const message = error.response?.data?.detail || 'Error al cargar perfil';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDay = (day: string) => {
    setEditingDay(day);
    setModalVisible(true);
  };

  const handleSaveSchedule = async () => {
    try {
      if (!barberProfile) return;

      const token = await AsyncStorage.getItem('access_token');
      
      // Convert schedule to API format
      const apiSchedule: Record<string, { start: string; end: string }> = {};
      Object.entries(schedule).forEach(([day, daySchedule]) => {
        if (daySchedule.active) {
          apiSchedule[day] = {
            start: daySchedule.start,
            end: daySchedule.end,
          };
        }
      });

      await axios.put(`${API_URL}/api/barbers/${barberProfile.id}`, {
        ...barberProfile,
        schedule: apiSchedule,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert('Éxito', 'Horario actualizado correctamente');
      loadBarberProfile();
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      const message = error.response?.data?.detail || 'Error al guardar horario';
      Alert.alert('Error', message);
    }
  };

  const toggleDayActive = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        active: !prev[day].active,
      },
    }));
  };

  const updateDayTime = (day: string, field: 'start' | 'end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const getWorkingDaysCount = () => {
    return Object.values(schedule).filter(day => day.active).length;
  };

  const getWeeklyHours = () => {
    let totalMinutes = 0;
    Object.values(schedule).forEach(day => {
      if (day.active) {
        const startMinutes = parseInt(day.start.split(':')[0]) * 60 + parseInt(day.start.split(':')[1]);
        const endMinutes = parseInt(day.end.split(':')[0]) * 60 + parseInt(day.end.split(':')[1]);
        totalMinutes += endMinutes - startMinutes;
      }
    });
    return Math.floor(totalMinutes / 60);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Cargando horario...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Horario</Text>
        <TouchableOpacity onPress={handleSaveSchedule}>
          <Ionicons name="checkmark" size={24} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{getWorkingDaysCount()}</Text>
            <Text style={styles.statLabel}>Días Laborales</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{getWeeklyHours()}</Text>
            <Text style={styles.statLabel}>Horas Semanales</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {schedule.monday.active ? schedule.monday.start : '--:--'}
            </Text>
            <Text style={styles.statLabel}>Inicio Típico</Text>
          </View>
        </View>

        {/* Schedule Days */}
        <View style={styles.scheduleContainer}>
          <Text style={styles.sectionTitle}>Horario Semanal</Text>
          
          {Object.entries(schedule).map(([day, daySchedule]) => (
            <View key={day} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{dayTranslations[day]}</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    daySchedule.active && styles.toggleButtonActive,
                  ]}
                  onPress={() => toggleDayActive(day)}
                >
                  <Ionicons 
                    name={daySchedule.active ? "checkmark" : "close"} 
                    size={16} 
                    color={daySchedule.active ? "#0A0A0A" : "#666666"} 
                  />
                </TouchableOpacity>
              </View>

              {daySchedule.active && (
                <View style={styles.dayContent}>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => handleEditDay(day)}
                  >
                    <View style={styles.timeInfo}>
                      <Ionicons name="time-outline" size={16} color="#D4AF37" />
                      <Text style={styles.timeText}>
                        {daySchedule.start} - {daySchedule.end}
                      </Text>
                    </View>
                    <Ionicons name="pencil" size={16} color="#D4AF37" />
                  </TouchableOpacity>

                  <View style={styles.dayStats}>
                    <Text style={styles.dayStatText}>
                      {(() => {
                        const startMinutes = parseInt(daySchedule.start.split(':')[0]) * 60 + parseInt(daySchedule.start.split(':')[1]);
                        const endMinutes = parseInt(daySchedule.end.split(':')[0]) * 60 + parseInt(daySchedule.end.split(':')[1]);
                        const hours = Math.floor((endMinutes - startMinutes) / 60);
                        return `${hours} horas laborales`;
                      })()}
                    </Text>
                  </View>
                </View>
              )}

              {!daySchedule.active && (
                <View style={styles.inactiveDay}>
                  <Text style={styles.inactiveDayText}>Día libre</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          
          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="copy-outline" size={24} color="#D4AF37" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Copiar Horario</Text>
              <Text style={styles.actionSubtitle}>Aplicar mismo horario a varios días</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="calendar-outline" size={24} color="#D4AF37" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Días Especiales</Text>
              <Text style={styles.actionSubtitle}>Configurar horarios de feriados</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <Ionicons name="notifications-outline" size={24} color="#D4AF37" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Notificaciones</Text>
              <Text style={styles.actionSubtitle}>Recordatorios de inicio de turno</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Time Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Editar {dayTranslations[editingDay]}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>Hora de Inicio</Text>
                <TextInput
                  style={styles.timeInput}
                  value={schedule[editingDay]?.start || ''}
                  onChangeText={(text) => updateDayTime(editingDay, 'start', text)}
                  placeholder="09:00"
                  placeholderTextColor="#666666"
                />
              </View>

              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>Hora de Fin</Text>
                <TextInput
                  style={styles.timeInput}
                  value={schedule[editingDay]?.end || ''}
                  onChangeText={(text) => updateDayTime(editingDay, 'end', text)}
                  placeholder="18:00"
                  placeholderTextColor="#666666"
                />
              </View>

              <View style={styles.presetTimesContainer}>
                <Text style={styles.inputLabel}>Horarios Comunes</Text>
                <View style={styles.presetTimes}>
                  {[
                    { label: 'Mañana', start: '09:00', end: '13:00' },
                    { label: 'Tarde', start: '14:00', end: '18:00' },
                    { label: 'Completo', start: '09:00', end: '18:00' },
                    { label: 'Sábado', start: '09:00', end: '15:00' },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={styles.presetButton}
                      onPress={() => {
                        updateDayTime(editingDay, 'start', preset.start);
                        updateDayTime(editingDay, 'end', preset.end);
                      }}
                    >
                      <Text style={styles.presetButtonText}>{preset.label}</Text>
                      <Text style={styles.presetButtonTime}>{preset.start} - {preset.end}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  statLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginTop: 4,
    textAlign: 'center',
  },
  scheduleContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  dayCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#D4AF37',
  },
  dayContent: {
    gap: 8,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dayStats: {
    paddingLeft: 8,
  },
  dayStatText: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  inactiveDay: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  inactiveDayText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  actionCard: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalContent: {
    padding: 20,
  },
  timeInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  presetTimesContainer: {
    marginTop: 20,
  },
  presetTimes: {
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  presetButtonTime: {
    fontSize: 12,
    color: '#D4AF37',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666666',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
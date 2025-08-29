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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
}

interface Barber {
  id: string;
  name: string;
  specialties: string[];
  bio: string;
  avatar_base64: string;
  schedule: Record<string, { start: string; end: string }>;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function BookAppointment() {
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    loadServices();
    loadBarbers();
  }, []);

  useEffect(() => {
    if (selectedBarber && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedBarber, selectedDate]);

  const loadServices = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setServices(response.data);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'No se pudieron cargar los servicios');
    } finally {
      setLoading(false);
    }
  };

  const loadBarbers = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/barbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBarbers(response.data);
    } catch (error) {
      console.error('Error loading barbers:', error);
      Alert.alert('Error', 'No se pudieron cargar los barberos');
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedBarber) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      const dateStr = selectedDate.toISOString();
      const response = await axios.get(
        `${API_URL}/api/barbers/${selectedBarber.id}/availability?date=${dateStr}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAvailableSlots(response.data.available_slots);
    } catch (error) {
      console.error('Error loading availability:', error);
      setAvailableSlots([]);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedService || !selectedBarber || !selectedTime) {
      Alert.alert('Error', 'Por favor completa toda la información');
      return;
    }

    setBooking(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userData = await AsyncStorage.getItem('user_data');
      const user = userData ? JSON.parse(userData) : null;

      const appointmentData = {
        client_id: user.id,
        barber_id: selectedBarber.id,
        service_id: selectedService.id,
        scheduled_at: selectedTime,
        notes: ''
      };

      await axios.post(`${API_URL}/api/appointments`, appointmentData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert(
        '¡Cita Agendada!',
        `Tu cita con ${selectedBarber.name} para ${selectedService.name} ha sido agendada exitosamente.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/client/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      const message = error.response?.data?.detail || 'Error al agendar la cita';
      Alert.alert('Error', message);
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Cargando servicios...</Text>
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
        <Text style={styles.headerTitle}>Agendar Cita</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressStep, currentStep >= 1 && styles.progressActive]}>
            <Text style={[styles.stepText, currentStep >= 1 && styles.stepActive]}>1</Text>
          </View>
          <View style={[styles.progressLine, currentStep >= 2 && styles.lineActive]} />
          <View style={[styles.progressStep, currentStep >= 2 && styles.progressActive]}>
            <Text style={[styles.stepText, currentStep >= 2 && styles.stepActive]}>2</Text>
          </View>
          <View style={[styles.progressLine, currentStep >= 3 && styles.lineActive]} />
          <View style={[styles.progressStep, currentStep >= 3 && styles.progressActive]}>
            <Text style={[styles.stepText, currentStep >= 3 && styles.stepActive]}>3</Text>
          </View>
          <View style={[styles.progressLine, currentStep >= 4 && styles.lineActive]} />
          <View style={[styles.progressStep, currentStep >= 4 && styles.progressActive]}>
            <Text style={[styles.stepText, currentStep >= 4 && styles.stepActive]}>4</Text>
          </View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabel}>Servicio</Text>
          <Text style={styles.stepLabel}>Barbero</Text>
          <Text style={styles.stepLabel}>Fecha</Text>
          <Text style={styles.stepLabel}>Confirmar</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Step 1: Select Service */}
        {currentStep === 1 && (
          <View>
            <Text style={styles.stepTitle}>Selecciona un Servicio</Text>
            <View style={styles.servicesGrid}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceCard,
                    selectedService?.id === service.id && styles.serviceCardSelected,
                  ]}
                  onPress={() => setSelectedService(service)}
                >
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>${service.price}</Text>
                  </View>
                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}
                  <View style={styles.serviceFooter}>
                    <Text style={styles.serviceDuration}>{service.duration_minutes} min</Text>
                    {service.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{service.category}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Select Barber */}
        {currentStep === 2 && (
          <View>
            <Text style={styles.stepTitle}>Selecciona tu Barbero</Text>
            <View style={styles.barbersContainer}>
              {barbers.map((barber) => (
                <TouchableOpacity
                  key={barber.id}
                  style={[
                    styles.barberCard,
                    selectedBarber?.id === barber.id && styles.barberCardSelected,
                  ]}
                  onPress={() => setSelectedBarber(barber)}
                >
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{barber.name}</Text>
                    {barber.specialties.length > 0 && (
                      <Text style={styles.barberSpecialties}>
                        {barber.specialties.join(', ')}
                      </Text>
                    )}
                    {barber.bio && (
                      <Text style={styles.barberBio}>{barber.bio}</Text>
                    )}
                  </View>
                  <Ionicons 
                    name={selectedBarber?.id === barber.id ? "checkmark-circle" : "person-circle-outline"} 
                    size={40} 
                    color={selectedBarber?.id === barber.id ? "#D4AF37" : "#666666"} 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Select Date & Time */}
        {currentStep === 3 && (
          <View>
            <Text style={styles.stepTitle}>Selecciona Fecha y Hora</Text>
            
            {/* Date Selection */}
            <Text style={styles.sectionLabel}>Fecha:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              <View style={styles.dateContainer}>
                {generateDateOptions().map((date, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      selectedDate.toDateString() === date.toDateString() && styles.dateCardSelected,
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[
                      styles.dateDay,
                      selectedDate.toDateString() === date.toDateString() && styles.dateDaySelected,
                    ]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[
                      styles.dateWeekday,
                      selectedDate.toDateString() === date.toDateString() && styles.dateWeekdaySelected,
                    ]}>
                      {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Time Selection */}
            <Text style={styles.sectionLabel}>Hora disponible:</Text>
            <View style={styles.timeGrid}>
              {availableSlots.length === 0 ? (
                <View style={styles.noSlotsContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#666666" />
                  <Text style={styles.noSlotsText}>No hay horarios disponibles</Text>
                  <Text style={styles.noSlotsSubtext}>Intenta con otra fecha</Text>
                </View>
              ) : (
                availableSlots.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.timeSlot,
                      selectedTime === slot && styles.timeSlotSelected,
                    ]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[
                      styles.timeText,
                      selectedTime === slot && styles.timeTextSelected,
                    ]}>
                      {formatTime(slot)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 4 && (
          <View>
            <Text style={styles.stepTitle}>Confirmar Cita</Text>
            
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="cut-outline" size={20} color="#D4AF37" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Servicio</Text>
                  <Text style={styles.summaryValue}>{selectedService?.name}</Text>
                </View>
                <Text style={styles.summaryPrice}>${selectedService?.price}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Ionicons name="person-outline" size={20} color="#D4AF37" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Barbero</Text>
                  <Text style={styles.summaryValue}>{selectedBarber?.name}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={20} color="#D4AF37" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Fecha y Hora</Text>
                  <Text style={styles.summaryValue}>
                    {formatDate(selectedDate)} - {formatTime(selectedTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Ionicons name="time-outline" size={20} color="#D4AF37" />
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Duración</Text>
                  <Text style={styles.summaryValue}>{selectedService?.duration_minutes} minutos</Text>
                </View>
              </View>
            </View>

            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total a pagar en el local:</Text>
              <Text style={styles.totalAmount}>${selectedService?.price}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={styles.backButtonText}>Anterior</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            (currentStep === 1 && !selectedService) ||
            (currentStep === 2 && !selectedBarber) ||
            (currentStep === 3 && (!selectedDate || !selectedTime)) ||
            booking
              ? styles.disabledButton
              : null,
          ]}
          onPress={() => {
            if (currentStep < 4) {
              setCurrentStep(currentStep + 1);
            } else {
              handleBookAppointment();
            }
          }}
          disabled={
            (currentStep === 1 && !selectedService) ||
            (currentStep === 2 && !selectedBarber) ||
            (currentStep === 3 && (!selectedDate || !selectedTime)) ||
            booking
          }
        >
          {booking ? (
            <ActivityIndicator size="small" color="#0A0A0A" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep < 4 ? 'Siguiente' : 'Confirmar Cita'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  progressContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressActive: {
    backgroundColor: '#D4AF37',
  },
  stepText: {
    color: '#666666',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepActive: {
    color: '#0A0A0A',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#333333',
    marginHorizontal: 8,
  },
  lineActive: {
    backgroundColor: '#D4AF37',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  servicesGrid: {
    gap: 16,
  },
  serviceCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceCardSelected: {
    borderColor: '#D4AF37',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 12,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceDuration: {
    fontSize: 12,
    color: '#666666',
  },
  categoryBadge: {
    backgroundColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: '#D4AF37',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  barbersContainer: {
    gap: 16,
  },
  barberCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  barberCardSelected: {
    borderColor: '#D4AF37',
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  barberSpecialties: {
    fontSize: 14,
    color: '#D4AF37',
    marginBottom: 4,
  },
  barberBio: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  dateScroll: {
    marginBottom: 24,
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 24,
  },
  dateCard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateCardSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#2A2A1A',
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dateDaySelected: {
    color: '#D4AF37',
  },
  dateWeekday: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  dateWeekdaySelected: {
    color: '#D4AF37',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeSlot: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#2A2A1A',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  timeTextSelected: {
    color: '#D4AF37',
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSlotsText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    fontWeight: '600',
  },
  noSlotsSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    padding: 20,
    backgroundColor: '#2A2A1A',
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  bottomContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
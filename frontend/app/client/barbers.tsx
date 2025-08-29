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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Barber {
  id: string;
  name: string;
  specialties: string[];
  bio: string;
  avatar_base64: string;
  schedule: Record<string, { start: string; end: string }>;
  user_id: string;
}

export default function BarbersScreen() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBarbers();
  }, []);

  const loadBarbers = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/barbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBarbers(response.data);
    } catch (error: any) {
      console.error('Error loading barbers:', error);
      const message = error.response?.data?.detail || 'Error al cargar barberos';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBarbers();
    setRefreshing(false);
  };

  const handleBookWithBarber = (barber: Barber) => {
    // Navigate to booking with pre-selected barber
    router.push('/client/book-appointment');
  };

  const getWorkingDays = (schedule: Record<string, { start: string; end: string }>) => {
    const days = Object.keys(schedule);
    if (days.length === 0) return 'Horarios por definir';
    
    const dayTranslations: Record<string, string> = {
      monday: 'Lun',
      tuesday: 'Mar',
      wednesday: 'Mié',
      thursday: 'Jue',
      friday: 'Vie',
      saturday: 'Sáb',
      sunday: 'Dom',
    };
    
    return days.map(day => dayTranslations[day] || day).join(', ');
  };

  const getWorkingHours = (schedule: Record<string, { start: string; end: string }>) => {
    const scheduleEntries = Object.entries(schedule);
    if (scheduleEntries.length === 0) return '';
    
    // Assuming same hours for all working days
    const firstDay = scheduleEntries[0][1];
    return `${firstDay.start} - ${firstDay.end}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Cargando barberos...</Text>
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
        <Text style={styles.headerTitle}>Nuestros Barberos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroTitle}>Equipo Elite</Text>
          <Text style={styles.heroSubtitle}>
            Profesionales expertos en arte masculino con años de experiencia
          </Text>
        </View>

        {/* Barbers List */}
        <View style={styles.barbersContainer}>
          {barbers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#666666" />
              <Text style={styles.emptyText}>No hay barberos disponibles</Text>
              <Text style={styles.emptySubtext}>Pronto se unirán nuevos profesionales</Text>
            </View>
          ) : (
            barbers.map((barber) => (
              <View key={barber.id} style={styles.barberCard}>
                {/* Barber Header */}
                <View style={styles.barberHeader}>
                  <View style={styles.avatarContainer}>
                    {barber.avatar_base64 ? (
                      <Image 
                        source={{ uri: `data:image/jpeg;base64,${barber.avatar_base64}` }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={32} color="#D4AF37" />
                      </View>
                    )}
                    <View style={styles.statusBadge}>
                      <View style={styles.statusIndicator} />
                    </View>
                  </View>
                  
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{barber.name}</Text>
                    {barber.specialties.length > 0 && (
                      <View style={styles.specialtiesContainer}>
                        {barber.specialties.slice(0, 2).map((specialty, index) => (
                          <View key={index} style={styles.specialtyBadge}>
                            <Text style={styles.specialtyText}>{specialty}</Text>
                          </View>
                        ))}
                        {barber.specialties.length > 2 && (
                          <View style={styles.specialtyBadge}>
                            <Text style={styles.specialtyText}>+{barber.specialties.length - 2}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Barber Content */}
                <View style={styles.barberContent}>
                  {barber.bio && (
                    <Text style={styles.barberBio}>{barber.bio}</Text>
                  )}
                  
                  <View style={styles.scheduleContainer}>
                    <View style={styles.scheduleItem}>
                      <Ionicons name="calendar-outline" size={16} color="#D4AF37" />
                      <Text style={styles.scheduleText}>{getWorkingDays(barber.schedule)}</Text>
                    </View>
                    
                    {getWorkingHours(barber.schedule) && (
                      <View style={styles.scheduleItem}>
                        <Ionicons name="time-outline" size={16} color="#D4AF37" />
                        <Text style={styles.scheduleText}>{getWorkingHours(barber.schedule)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Specialties Full List */}
                  {barber.specialties.length > 0 && (
                    <View style={styles.fullSpecialtiesContainer}>
                      <Text style={styles.specialtiesTitle}>Especialidades:</Text>
                      <View style={styles.specialtiesList}>
                        {barber.specialties.map((specialty, index) => (
                          <View key={index} style={styles.fullSpecialtyItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <Text style={styles.fullSpecialtyText}>{specialty}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Barber Actions */}
                <View style={styles.barberActions}>
                  <TouchableOpacity 
                    style={styles.bookButton}
                    onPress={() => handleBookWithBarber(barber)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#0A0A0A" />
                    <Text style={styles.bookButtonText}>Agendar con {barber.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.viewButton}>
                    <Ionicons name="eye-outline" size={20} color="#D4AF37" />
                    <Text style={styles.viewButtonText}>Ver Disponibilidad</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Team Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Nuestro Equipo</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{barbers.length}</Text>
              <Text style={styles.statLabel}>Barberos Activos</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>5+</Text>
              <Text style={styles.statLabel}>Años Experiencia</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>100%</Text>
              <Text style={styles.statLabel}>Profesionales</Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.ctaContainer}>
          <View style={styles.ctaCard}>
            <Ionicons name="star" size={32} color="#D4AF37" />
            <Text style={styles.ctaTitle}>Experiencia Elite</Text>
            <Text style={styles.ctaSubtitle}>
              Todos nuestros barberos son profesionales certificados con amplia experiencia en técnicas modernas y clásicas.
            </Text>
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={() => router.push('/client/book-appointment')}
            >
              <Text style={styles.ctaButtonText}>Agendar Ahora</Text>
            </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  heroContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D4AF37',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
  },
  barbersContainer: {
    paddingHorizontal: 24,
    gap: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
  barberCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  barberHeader: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  barberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  barberName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 11,
    color: '#0A0A0A',
    fontWeight: 'bold',
  },
  barberContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  barberBio: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
    marginBottom: 16,
  },
  scheduleContainer: {
    marginBottom: 16,
    gap: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  fullSpecialtiesContainer: {
    marginTop: 8,
  },
  specialtiesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 8,
  },
  specialtiesList: {
    gap: 6,
  },
  fullSpecialtyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullSpecialtyText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  barberActions: {
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  bookButton: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  viewButtonText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  ctaCard: {
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
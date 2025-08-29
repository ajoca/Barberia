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

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  active: boolean;
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/api/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setServices(response.data);
    } catch (error: any) {
      console.error('Error loading services:', error);
      const message = error.response?.data?.detail || 'Error al cargar servicios';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  };

  const handleBookService = (service: Service) => {
    // Navigate to booking with pre-selected service
    router.push('/client/book-appointment');
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'corte':
        return 'cut-outline';
      case 'barba':
        return 'man-outline';
      case 'completo':
        return 'checkmark-circle-outline';
      case 'premium':
        return 'star-outline';
      default:
        return 'cut-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'corte':
        return '#10B981';
      case 'barba':
        return '#8B5CF6';
      case 'completo':
        return '#F59E0B';
      case 'premium':
        return '#D4AF37';
      default:
        return '#6B7280';
    }
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
        <Text style={styles.headerTitle}>Nuestros Servicios</Text>
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
          <Text style={styles.heroTitle}>Servicios Elite</Text>
          <Text style={styles.heroSubtitle}>
            Experiencia premium en cortes masculinos y cuidado personal
          </Text>
        </View>

        {/* Services Grid */}
        <View style={styles.servicesContainer}>
          {services.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cut-outline" size={64} color="#666666" />
              <Text style={styles.emptyText}>No hay servicios disponibles</Text>
              <Text style={styles.emptySubtext}>Pronto agregaremos nuevos servicios</Text>
            </View>
          ) : (
            services.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                {/* Service Header */}
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceTitleContainer}>
                    <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(service.category) }]}>
                      <Ionicons 
                        name={getCategoryIcon(service.category) as any} 
                        size={24} 
                        color="#FFFFFF" 
                      />
                    </View>
                    <View style={styles.serviceTitleText}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      {service.category && (
                        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(service.category) }]}>
                          <Text style={styles.categoryText}>{service.category.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.servicePrice}>${service.price}</Text>
                </View>

                {/* Service Content */}
                <View style={styles.serviceContent}>
                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}
                  
                  <View style={styles.serviceDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color="#D4AF37" />
                      <Text style={styles.detailText}>{service.duration_minutes} minutos</Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Ionicons name="cash-outline" size={16} color="#D4AF37" />
                      <Text style={styles.detailText}>Pago en local</Text>
                    </View>
                  </View>
                </View>

                {/* Service Actions */}
                <View style={styles.serviceActions}>
                  <TouchableOpacity 
                    style={styles.bookButton}
                    onPress={() => handleBookService(service)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#0A0A0A" />
                    <Text style={styles.bookButtonText}>Agendar Cita</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Additional Info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color="#D4AF37" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Información Importante</Text>
              <Text style={styles.infoText}>
                • Todos los pagos se realizan en el local{'\n'}
                • Llegada 10 minutos antes de tu cita{'\n'}
                • Cancela con 2 horas de anticipación{'\n'}
                • Recibirás notificación por WhatsApp
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="star-outline" size={24} color="#D4AF37" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Política de Calidad</Text>
              <Text style={styles.infoText}>
                Si no estás satisfecho con tu servicio, te ofrecemos una segunda sesión gratuita dentro de las 48 horas.
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.ctaContainer}>
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>¿No encuentras lo que buscas?</Text>
            <Text style={styles.ctaSubtitle}>
              Contacta directamente con nosotros para servicios personalizados
            </Text>
            <TouchableOpacity style={styles.ctaButton}>
              <Ionicons name="chatbubble-outline" size={20} color="#0A0A0A" />
              <Text style={styles.ctaButtonText}>Contactar por WhatsApp</Text>
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
  servicesContainer: {
    paddingHorizontal: 24,
    gap: 20,
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
  serviceCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
  },
  serviceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceTitleText: {
    flex: 1,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  servicePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  serviceContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  serviceDescription: {
    fontSize: 16,
    color: '#B0B0B0',
    lineHeight: 24,
    marginBottom: 16,
  },
  serviceDetails: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  serviceActions: {
    padding: 20,
    paddingTop: 16,
  },
  bookButton: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  ctaButtonText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
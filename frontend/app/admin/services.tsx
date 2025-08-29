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

interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  category: string;
  active: boolean;
}

export default function AdminServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: '',
    price: '',
    category: '',
  });

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

  const handleCreateService = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      duration_minutes: '',
      price: '',
      category: '',
    });
    setModalVisible(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes.toString(),
      price: service.price.toString(),
      category: service.category || '',
    });
    setModalVisible(true);
  };

  const handleSaveService = async () => {
    if (!formData.name || !formData.duration_minutes || !formData.price) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      
      const serviceData = {
        name: formData.name,
        description: formData.description,
        duration_minutes: parseInt(formData.duration_minutes),
        price: parseFloat(formData.price),
        category: formData.category,
      };

      if (editingService) {
        // Update existing service
        await axios.put(`${API_URL}/api/services/${editingService.id}`, serviceData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Alert.alert('Éxito', 'Servicio actualizado correctamente');
      } else {
        // Create new service
        await axios.post(`${API_URL}/api/services`, serviceData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Alert.alert('Éxito', 'Servicio creado correctamente');
      }

      setModalVisible(false);
      loadServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      const message = error.response?.data?.detail || 'Error al guardar servicio';
      Alert.alert('Error', message);
    }
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
        <Text style={styles.headerTitle}>Gestión de Servicios</Text>
        <TouchableOpacity onPress={handleCreateService}>
          <Ionicons name="add-circle" size={24} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{services.length}</Text>
            <Text style={styles.statLabel}>Total Servicios</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{services.filter(s => s.active).length}</Text>
            <Text style={styles.statLabel}>Activos</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              ${services.reduce((sum, s) => sum + s.price, 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Precio Promedio</Text>
          </View>
        </View>

        {/* Services List */}
        <View style={styles.servicesContainer}>
          {services.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cut-outline" size={64} color="#666666" />
              <Text style={styles.emptyText}>No hay servicios creados</Text>
              <TouchableOpacity style={styles.createButton} onPress={handleCreateService}>
                <Text style={styles.createButtonText}>Crear Primer Servicio</Text>
              </TouchableOpacity>
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
                        size={20} 
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
                  
                  <View style={styles.serviceActions}>
                    <Text style={styles.servicePrice}>${service.price}</Text>
                    <TouchableOpacity onPress={() => handleEditService(service)}>
                      <Ionicons name="pencil" size={20} color="#D4AF37" />
                    </TouchableOpacity>
                  </View>
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
                      <Ionicons 
                        name={service.active ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={service.active ? "#10B981" : "#EF4444"} 
                      />
                      <Text style={[styles.detailText, { color: service.active ? "#10B981" : "#EF4444" }]}>
                        {service.active ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create/Edit Modal */}
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
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nombre del Servicio *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Ej: Corte de Cabello"
                  placeholderTextColor="#666666"
                />
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Descripción</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Descripción del servicio"
                  placeholderTextColor="#666666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Duration */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Duración (minutos) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.duration_minutes}
                  onChangeText={(text) => setFormData({ ...formData, duration_minutes: text })}
                  placeholder="30"
                  placeholderTextColor="#666666"
                  keyboardType="numeric"
                />
              </View>

              {/* Price */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Precio *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                  placeholder="25.00"
                  placeholderTextColor="#666666"
                  keyboardType="numeric"
                />
              </View>

              {/* Category */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Categoría</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.category}
                  onChangeText={(text) => setFormData({ ...formData, category: text })}
                  placeholder="corte, barba, completo, premium"
                  placeholderTextColor="#666666"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveService}
              >
                <Text style={styles.saveButtonText}>
                  {editingService ? 'Actualizar' : 'Crear'}
                </Text>
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
    marginBottom: 24,
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
  servicesContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 20,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceTitleText: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  serviceActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
  },
  serviceContent: {
    gap: 12,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#FFFFFF',
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
    maxHeight: '80%',
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
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
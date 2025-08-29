
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const mockBarbers = [
  { id: '1', name: 'Juan Pérez' },
  { id: '2', name: 'Carlos Gómez' },
  { id: '3', name: 'Luis Martínez' },
];

export default function Barbers() {
  const [barbers, setBarbers] = useState(mockBarbers);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Barberos</Text>
      <TouchableOpacity style={styles.addButton}>
        <Ionicons name="person-add" size={20} color="#0A0A0A" />
        <Text style={styles.addButtonText}>Agregar Barbero</Text>
      </TouchableOpacity>
      <ScrollView style={styles.listContainer}>
        {barbers.map(barber => (
          <View key={barber.id} style={styles.barberCard}>
            <Ionicons name="person" size={24} color="#D4AF37" />
            <Text style={styles.barberName}>{barber.name}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 16,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0A0A0A',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  listContainer: {
    flex: 1,
  },
  barberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  barberName: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 12,
  },
});

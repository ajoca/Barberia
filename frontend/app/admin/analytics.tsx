
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Analytics() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Analíticas</Text>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Ionicons name="stats-chart" size={32} color="#D4AF37" style={{ marginBottom: 8 }} />
          <Text style={styles.cardTitle}>Ingresos Semanales</Text>
          <Text style={styles.cardValue}>$1,250</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="people" size={32} color="#D4AF37" style={{ marginBottom: 8 }} />
          <Text style={styles.cardTitle}>Clientes Atendidos</Text>
          <Text style={styles.cardValue}>48</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="cut" size={32} color="#D4AF37" style={{ marginBottom: 8 }} />
          <Text style={styles.cardTitle}>Servicios Realizados</Text>
          <Text style={styles.cardValue}>120</Text>
        </View>
        <View style={styles.card}>
          <Ionicons name="calendar" size={32} color="#D4AF37" style={{ marginBottom: 8 }} />
          <Text style={styles.cardTitle}>Citas Completadas</Text>
          <Text style={styles.cardValue}>35</Text>
        </View>
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
  scrollContainer: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#B0B0B0',
    fontSize: 16,
    marginBottom: 4,
  },
  cardValue: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

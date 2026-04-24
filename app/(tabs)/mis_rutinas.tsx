import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';

export default function MisRutinasScreen() {
    const router = useRouter();
    const [rutinasAsignadas, setRutinasAsignadas] = useState<any[]>([]);
    const [rutinasEmpezadas, setRutinasEmpezadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchRutinas();
        }, [])
    );

    const fetchRutinas = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Obtener rutinas asignadas
            const { data: asignadasData, error: errAsignadas } = await supabase
                .from('rutina')
                .select('*')
                .eq('usuario_id', user.id);
            if (errAsignadas) throw errAsignadas;

            // 2. Obtener el registro de rutinas empezadas
            const { data: empezadasData, error: errEmpezadas } = await supabase
                .from('progreso_rutina')
                .select(`
                    id_rut,
                    prog_ejercicios_completados,
                    prog_porcentaje,
                    prog_completada,
                    rutina(id_rut, rut_nom, rut_img, rut_zona)
                `)
                .eq('id_us', user.id);
            if (errEmpezadas) throw errEmpezadas;

            // 3. Recalcular el progreso dinámicamente para filtrar los "datos fantasma"
            const rutinasIds = empezadasData?.map(p => p.id_rut) || [];
            let rutinasEmpezadasReales: any[] = [];

            if (rutinasIds.length > 0) {
                // Traer todos los ejercicios que conforman estas rutinas actualmente
                const { data: rutinaEjes } = await supabase
                    .from('rutina_eje')
                    .select('id_rut, id_eje')
                    .in('id_rut', rutinasIds);

                // Traer todas las sesiones completadas por el usuario para estas rutinas
                const { data: sesiones } = await supabase
                    .from('sesion')
                    .select('id_rut, id_eje')
                    .eq('id_us', user.id)
                    .eq('se_completado', true)
                    .in('id_rut', rutinasIds);

                // Mapear los ejercicios válidos por rutina
                const validEjesPorRutina: Record<string, Set<string>> = {};
                rutinaEjes?.forEach(re => {
                    if (!validEjesPorRutina[re.id_rut]) validEjesPorRutina[re.id_rut] = new Set();
                    validEjesPorRutina[re.id_rut].add(re.id_eje);
                });

                // Mapear las sesiones completadas que hacen match con los ejercicios válidos
                const completadosPorRutina: Record<string, Set<string>> = {};
                sesiones?.forEach(s => {
                    const validEjes = validEjesPorRutina[s.id_rut];
                    if (validEjes && validEjes.has(s.id_eje)) {
                        if (!completadosPorRutina[s.id_rut]) completadosPorRutina[s.id_rut] = new Set();
                        completadosPorRutina[s.id_rut].add(s.id_eje);
                    }
                });

                // Asignar el nuevo porcentaje y filtrar
                empezadasData?.forEach(prog => {
                    const id_rut = prog.id_rut;
                    const total = validEjesPorRutina[id_rut]?.size || 1;
                    const completados = completadosPorRutina[id_rut]?.size || 0;
                    const porcentaje = Math.min(Math.round((completados / total) * 100), 100); // Asegura que tope en 100%

                    // Solo guardamos en la lista si el porcentaje real es mayor a 0
                    if (porcentaje > 0) {
                        rutinasEmpezadasReales.push({
                            ...prog,
                            prog_porcentaje: porcentaje,
                            prog_ejercicios_completados: completados,
                            prog_completada: completados >= total
                        });
                    }
                });
            }

            setRutinasAsignadas(asignadasData || []);
            setRutinasEmpezadas(rutinasEmpezadasReales);
        } catch (error) {
            console.error('Error al cargar rutinas:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderAsignada = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/rutina/${item.id_rut}` as any)}>
            <Image source={{ uri: item.rut_img || 'https://via.placeholder.com/150' }} style={styles.cardImage}></Image>
            <View style={styles.cardContent}>
                <Text style={styles.cardTag}>{item.rut_zona}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.rut_nom}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderEmpezada = ({ item }: { item: any }) => {
        const infoRutina = item.rutina;
        if (!infoRutina) return null;
        return (
            <TouchableOpacity style={styles.cardProgreso} onPress={() => router.push(`/rutina/${infoRutina.id_rut}` as any)}>
                <View style={styles.progresoHeader}>
                    <View style={styles.progresoInfo}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{infoRutina.rut_nom}</Text>
                        <Text style={styles.porcentajeTexto}>{item.prog_porcentaje}% Completado</Text>
                    </View>
                </View>
                <View style={styles.barraFondo}>
                    <View style={[styles.barraRelleno, { width: `${item.prog_porcentaje}%` }]}></View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centrado]}>
                <ActivityIndicator size="large" color="#9b1b6e" />
            </View>
        );
    }
    
    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Terapias</Text>
            </View>

            {rutinasEmpezadas.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="time" size={22} color="#9b1b6e" />
                        <Text style={styles.sectionTitle}>Continuar Terapia</Text>
                    </View>
                    <FlatList
                        data={rutinasEmpezadas}
                        renderItem={renderEmpezada}
                        keyExtractor={(item, index) => `empezada-${index}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.listPadding}
                    />
                </View>
            )}

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="clipboard" size={22} color="#9b1b6e" />
                    <Text style={styles.sectionTitle}>Asignadas por tu Fisioterapeuta</Text>
                </View>

                {rutinasAsignadas.length === 0 ? (
                    <Text style={styles.emptyText}>No tienes rutinas asignadas por el momento.</Text>
                ) : (
                    <FlatList
                        data={rutinasAsignadas}
                        renderItem={renderAsignada}
                        keyExtractor={(item) => item.id_rut}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.listPadding}
                    />
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    centrado: { justifyContent: 'center', alignItems: 'center' },
    header: { padding: 25, paddingTop: 60, paddingBottom: 10 },
    headerTitle: { fontSize: 32, fontWeight: 'bold', color: '#3d0030' },

    section: { marginTop: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginBottom: 15 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#3d0030', marginLeft: 8 },
    listPadding: { paddingHorizontal: 20, paddingBottom: 10 },
    emptyText: { paddingHorizontal: 25, color: '#888888', fontStyle: 'italic' },

    // Estilos Tarjeta Asignada Normal
    card: { width: 160, backgroundColor: '#fce4f3', borderRadius: 15, marginHorizontal: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#e8a0d0' },
    cardImage: { width: '100%', height: 120, backgroundColor: '#e8a0d0' },
    cardContent: { padding: 12 },
    cardTag: { fontSize: 11, color: '#9b1b6e', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#3d0030' },

    // Estilos Tarjeta Progreso
    cardProgreso: { width: 260, backgroundColor: '#ffffff', borderRadius: 15, marginHorizontal: 5, padding: 15, borderWidth: 1, borderColor: '#e8a0d0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    progresoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    progresoImage: { width: 60, height: 60, borderRadius: 10, marginRight: 15, backgroundColor: '#fce4f3' },
    progresoInfo: { flex: 1 },
    porcentajeTexto: { fontSize: 13, color: '#9b1b6e', fontWeight: '600', marginTop: 5 },
    barraFondo: { height: 8, backgroundColor: '#fdebf7', borderRadius: 4, overflow: 'hidden' },
    barraRelleno: { height: '100%', backgroundColor: '#9b1b6e', borderRadius: 4 },
});
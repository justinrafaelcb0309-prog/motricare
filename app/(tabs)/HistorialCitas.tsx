import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, FlatList, RefreshControl,
    StyleSheet, Text, View
} from 'react-native';
import { supabase } from '../../src/services/supabase';

export default function HistorialCitas() {
    const [historial, setHistorial] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { fetchHistorial(); }, []);

    const fetchHistorial = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const hoy = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('citas')
                .select(`
                    id, fecha, hora_inicio, motivo, estado,
                    fisioterapeutas ( nombre, apellido_paterno )
                `)
                .eq('usuario_id', user.id)
                .or(`estado.eq.cancelada,fecha.lt.${hoy}`)
                .order('fecha', { ascending: false });

            if (error) throw error;
            setHistorial(data || []);
        } catch (error: any) {
            console.log('Error cargando historial:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const esCancelada = item.estado === 'cancelada';
        return (
            <View style={[styles.card, esCancelada && styles.cardCancelada]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.badge, esCancelada ? styles.badgeRed : styles.badgeGreen]}>
                        <Text style={styles.badgeText}>
                            {esCancelada ? 'CANCELADA' : 'COMPLETADA'}
                        </Text>
                    </View>
                    <Text style={styles.fechaText}>{item.fecha}</Text>
                </View>
                <Text style={styles.fisioName}>Dr. {item.fisioterapeutas?.nombre}</Text>
                <Text style={styles.motivoText}>📋 {item.motivo}</Text>
                <Text style={styles.horaText}>⏰ Finalizada a las {item.hora_inicio}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Historial de Citas</Text>
                <Text style={styles.subtitle}>Citas pasadas y canceladas</Text>
            </View>
            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#9b1b6e" style={{ marginTop: 30 }} />
            ) : (
                <FlatList
                    data={historial}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHistorial} />}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No tienes citas en tu historial.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { padding: 25, paddingTop: 60, backgroundColor: '#f0f0f0' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
    card: {
        backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15,
        borderLeftWidth: 5, borderLeftColor: '#10b981',
        elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    cardCancelada: { borderLeftColor: '#ef4444', opacity: 0.8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    badgeGreen: { backgroundColor: '#d1fae5' },
    badgeRed: { backgroundColor: '#fee2e2' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    fechaText: { fontSize: 12, color: '#888', fontWeight: 'bold' },
    fisioName: { fontSize: 16, fontWeight: 'bold', color: '#3d0030' },
    motivoText: { fontSize: 14, color: '#666', marginVertical: 5 },
    horaText: { fontSize: 12, color: '#9b1b6e', fontWeight: '500' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#aaa' },
});
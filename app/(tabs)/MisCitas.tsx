import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
    Modal, TextInput, ScrollView
} from 'react-native';
import { supabase } from '../../src/services/supabase';

const HORARIOS_DISPONIBLES = [
    '09:00', '10:00', '11:00', '12:00', '13:00',
    '15:00', '16:00', '17:00', '18:00', '19:00'
];

export default function MisCitas() {
    const [citas, setCitas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [citaSeleccionada, setCitaSeleccionada] = useState<any>(null);
    const [nuevoMotivo, setNuevoMotivo] = useState('');
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [horaSeleccionada, setHoraSeleccionada] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => { fetchCitas(); }, []);

    const fetchCitas = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const hoy = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('citas')
                .select(`
                    id, fecha, hora_inicio, motivo,
                    fisioterapeuta_id, estado, usuario_id,
                    fisioterapeutas ( nombre, apellido_paterno )
                `)
                .eq('usuario_id', user.id)
                .neq('estado', 'cancelada')
                .gte('fecha', hoy) // ← Solo citas de hoy en adelante
                .order('fecha', { ascending: true });

            if (error) throw error;
            setCitas(data || []);
        } catch (error: any) {
            console.log('Error cargando lista:', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleGuardarEdicion = async () => {
        if (!nuevoMotivo || !nuevaFecha || !horaSeleccionada) {
            Alert.alert('Error', 'Por favor llena todos los campos.');
            return;
        }
        try {
            setGuardando(true);
            const { data: ocupada, error: errorValidacion } = await supabase
                .from('citas')
                .select('id')
                .eq('fisioterapeuta_id', citaSeleccionada.fisioterapeuta_id)
                .eq('fecha', nuevaFecha)
                .eq('hora_inicio', horaSeleccionada)
                .neq('id', citaSeleccionada.id)
                .neq('estado', 'cancelada');

            if (errorValidacion) throw errorValidacion;

            if (ocupada && ocupada.length > 0) {
                Alert.alert('Horario Ocupado', 'Este fisioterapeuta ya tiene una cita a esta hora.');
                setGuardando(false);
                return;
            }

            const { error } = await supabase
                .from('citas')
                .update({ motivo: nuevoMotivo, fecha: nuevaFecha, hora_inicio: horaSeleccionada })
                .eq('id', citaSeleccionada.id);

            if (error) throw error;
            Alert.alert('Éxito', 'La cita ha sido actualizada.');
            setModalVisible(false);
            fetchCitas();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo actualizar: ' + error.message);
        } finally {
            setGuardando(false);
        }
    };

    const ejecutarCancelacion = async (idCita: string) => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('citas')
                .update({ estado: 'cancelada' })
                .eq('id', idCita)
                .eq('usuario_id', user?.id);

            if (error) throw error;
            Alert.alert('Éxito', 'Cita cancelada correctamente.');
            fetchCitas();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelarCita = (id: string) => {
        Alert.alert('Confirmar', '¿Deseas cancelar esta cita?', [
            { text: 'No', style: 'cancel' },
            { text: 'Sí, cancelar', style: 'destructive', onPress: () => ejecutarCancelacion(id) }
        ]);
    };

    const renderCita = ({ item }: { item: any }) => (
        <View style={styles.citaCard}>
            <View style={styles.cardMain}>
                <View style={styles.dateBadge}>
                    <Text style={styles.dateText}>{item.fecha.split('-')[2]}</Text>
                </View>
                <View style={styles.info}>
                    <Text style={styles.fisioName}>Dr. {item.fisioterapeutas?.nombre}</Text>
                    <Text style={styles.subInfo}>⏰ {item.hora_inicio} | 📋 {item.motivo}</Text>
                </View>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.btnEdit}
                    onPress={() => {
                        setCitaSeleccionada(item);
                        setNuevoMotivo(item.motivo);
                        setNuevaFecha(item.fecha);
                        setHoraSeleccionada(item.hora_inicio);
                        setModalVisible(true);
                    }}
                >
                    <Text style={styles.btnEditText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCancel} onPress={() => handleCancelarCita(item.id)}>
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Mis Citas</Text>
                <Text style={styles.subtitle}>Próximas citas agendadas</Text>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#9b1b6e" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={citas}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderCita}
                    contentContainerStyle={{ padding: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchCitas} />}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No tienes citas próximas.</Text>
                    }
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Cita</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Motivo de consulta:</Text>
                            <TextInput
                                style={styles.input}
                                value={nuevoMotivo}
                                onChangeText={setNuevoMotivo}
                            />
                            <Text style={styles.label}>Fecha (AAAA-MM-DD):</Text>
                            <TextInput
                                style={styles.input}
                                value={nuevaFecha}
                                onChangeText={setNuevaFecha}
                                placeholder="Ej: 2026-04-15"
                            />
                            <Text style={styles.label}>Horarios Disponibles:</Text>
                            <View style={styles.horasGrid}>
                                {HORARIOS_DISPONIBLES.map((hora) => (
                                    <TouchableOpacity
                                        key={hora}
                                        style={[styles.horaItem, horaSeleccionada === hora && styles.horaSelected]}
                                        onPress={() => setHoraSeleccionada(hora)}
                                    >
                                        <Text style={[styles.horaText, horaSeleccionada === hora && styles.horaTextSelected]}>
                                            {hora}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.btnCerrar} onPress={() => setModalVisible(false)}>
                                <Text style={styles.btnCerrarText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarEdicion} disabled={guardando}>
                                {guardando
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.btnGuardarText}>Guardar</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { padding: 25, paddingTop: 60, backgroundColor: '#fce4f3' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#3d0030' },
    subtitle: { fontSize: 13, color: '#9b1b6e', marginTop: 4 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#aaa' },
    citaCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3, borderWidth: 1, borderColor: '#eee' },
    cardMain: { flexDirection: 'row', alignItems: 'center' },
    dateBadge: { backgroundColor: '#9b1b6e', padding: 10, borderRadius: 10, width: 45, alignItems: 'center' },
    dateText: { color: '#fff', fontWeight: 'bold' },
    info: { marginLeft: 15, flex: 1 },
    fisioName: { fontWeight: 'bold', fontSize: 16 },
    subInfo: { color: '#666', fontSize: 13, marginTop: 2 },
    actions: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
    btnEdit: { flex: 1, backgroundColor: '#fce4f3', padding: 8, borderRadius: 8, alignItems: 'center', marginRight: 10 },
    btnEditText: { color: '#9b1b6e', fontWeight: 'bold' },
    btnCancel: { flex: 1, backgroundColor: '#fee2e2', padding: 8, borderRadius: 8, alignItems: 'center' },
    btnCancelText: { color: '#991b1b', fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '85%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#9b1b6e' },
    label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5, color: '#444' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#f9f9f9' },
    horasGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
    horaItem: { width: '30%', padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10, alignItems: 'center' },
    horaSelected: { backgroundColor: '#9b1b6e', borderColor: '#9b1b6e' },
    horaText: { color: '#444', fontWeight: '500' },
    horaTextSelected: { color: '#fff', fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
    btnCerrar: { flex: 1, padding: 15, alignItems: 'center' },
    btnCerrarText: { color: '#666', fontWeight: 'bold' },
    btnGuardar: { flex: 1, backgroundColor: '#9b1b6e', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
    btnGuardarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
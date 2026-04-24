import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    Image, TouchableOpacity, ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type EjerciciosDetalle = {
    id_eje: string;
    eje_nom: string;
    eje_desc: string;
    eje_video: string;
    duracion: string;
    repeticiones: string;
};

type RutinaEje = {
    id_re: string;
    re_rep: number;
    re_dur: number;
    re_ord: number;
    ejercicios: EjerciciosDetalle;
};

type RutinaCompleta = {
    id_rut: string;
    rut_nom: string;
    rut_desc: string;
    rut_zona: string;
    rut_img: string;
    rutina_eje: RutinaEje[];
};

type ProgresoRutina = {
    id_prog: string;
    prog_ejercicios_completados: number;
    prog_ejercicios_total: number;
    prog_porcentaje: number;
    prog_completada: boolean;
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function DetalleRutinaScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [rutina, setRutina] = useState<RutinaCompleta | null>(null);
    const [progreso, setProgreso] = useState<ProgresoRutina>({
        id_prog: '',
        prog_ejercicios_completados: 0,
        prog_ejercicios_total: 0,
        prog_porcentaje: 0,
        prog_completada: false,
    });
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [ejerciciosCompletados, setEjerciciosCompletados] = useState<Set<string>>(new Set());

    // Obtener usuario actual al montar
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id);
        });
    }, []);

    // Cargar datos cuando tengamos userId e id
    useEffect(() => {
        if (!id || !userId) return;
        fetchDatos();

        // Suscripción en tiempo real FILTRADA por usuario
        const suscripcion = supabase
            .channel(`progreso-rutina-${id}-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'progreso_rutina',
                    filter: `id_rut=eq.${id}`,
                },
                () => fetchDatos()
            )
            .subscribe();

        return () => { supabase.removeChannel(suscripcion); };
    }, [id, userId]);

    const fetchDatos = async () => {
        if (!userId) return;
        try {
            setLoading(true);

            const [rutinaRes, progresoRes, sesionesRes] = await Promise.all([
                // Datos de la rutina
                supabase
                    .from('rutina')
                    .select(`
                        id_rut, rut_nom, rut_desc, rut_zona, rut_img,
                        rutina_eje(id_re, re_rep, re_dur, re_ord,
                            ejercicios(id_eje, eje_nom, eje_desc, eje_video, duracion, repeticiones)
                        )
                    `)
                    .eq('id_rut', id)
                    .single(),

                // Progreso FILTRADO por el usuario actual ← fix principal
                supabase
                    .from('progreso_rutina')
                    .select('id_prog, prog_ejercicios_completados, prog_ejercicios_total, prog_porcentaje, prog_completada')
                    .eq('id_rut', id)
                    .eq('id_us', userId)      // ← solo el progreso de ESTE usuario
                    .maybeSingle(),

                supabase
                    .from('sesion')
                    .select('id_eje')
                    .eq('id_rut', id)
                    .eq('id_us', userId)
                    .eq('se_completado', true),
            ]);

            if (rutinaRes.error) throw rutinaRes.error;
            if (progresoRes.error) throw progresoRes.error;

            if (rutinaRes.data) {
                rutinaRes.data.rutina_eje.sort((a: any, b: any) => a.re_ord - b.re_ord);
                setRutina(rutinaRes.data as unknown as RutinaCompleta);
                const validIds = new Set(rutinaRes.data.rutina_eje.map((item: any) => item.ejercicios.id_eje));

                if (sesionesRes.data) {
                    const idsCompletados = new Set(sesionesRes.data.map((s: any) => s.id_eje).filter((id: string) => validIds.has(id)));
                    setEjerciciosCompletados(idsCompletados);
                    // Recalcular porcentaje localmente para evitar valores > 100
                    const total = validIds.size || 1;
                    const completados = idsCompletados.size;
                    const porcentaje = Math.round((completados / total) * 100);

                    setProgreso({
                        id_prog: progresoRes.data?.id_prog ?? '',
                        prog_ejercicios_completados: completados,
                        prog_ejercicios_total: total,
                        prog_porcentaje: porcentaje,
                        prog_completada: completados >= total,
                    });
                    // } else {
                    //     // Sin registro de progreso aún — valores en 0
                    //     const total = rutinaRes.data?.rutina_eje?.length || 1;
                    //     setProgreso(prev => ({ ...prev, prog_ejercicios_total: total, prog_porcentaje: 0 }));
                }
            }
        } catch (error) {
            console.error('Error al descargar rutina:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContinuar = () => {
        if (!rutina || rutina.rutina_eje.length === 0) return;
        const primerPendiente = rutina.rutina_eje.find(e => !ejerciciosCompletados.has(e.ejercicios.id_eje));
        const idReActivo = primerPendiente ? primerPendiente.id_re : rutina.rutina_eje[0].id_re;
        router.push(`/ejercicio/${idReActivo}` as any);
    };

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.container, styles.centrado]}>
                <ActivityIndicator size="large" color="#9b1b6e" />
            </View>
        );
    }

    if (!rutina) {
        return (
            <View style={[styles.container, styles.centrado]}>
                <Text style={styles.emptyText}>No se encontró la rutina</Text>
            </View>
        );
    }

    const porcentajeSafe = Math.min(Math.max(progreso.prog_porcentaje, 0), 100);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Título en header + botón atrás nativo */}
            <Stack.Screen options={{ title: rutina.rut_nom, headerBackTitle: 'Atrás' }} />

            {/* Botón atrás explícito (por si el header no está visible) */}
            <TouchableOpacity
                style={styles.btnAtras}
                onPress={() => router.back()}
                accessibilityLabel="Regresar a la pantalla anterior"
                accessibilityRole="button"
            >
                <Ionicons name="arrow-back" size={20} color="#9b1b6e" />
                <Text style={styles.btnAtrasTexto}>Mis Rutinas</Text>
            </TouchableOpacity>

            <View style={styles.contenido}>
                <Text style={styles.textoZona}>{rutina.rut_zona}</Text>

                {/* Header: imagen + info */}
                <View style={styles.headerRow}>
                    <View style={styles.contenedorImagen}>
                        <Image
                            source={{ uri: rutina.rut_img || 'https://via.placeholder.com/100' }}
                            style={styles.imagenRutina}
                            resizeMode="cover"
                            accessibilityLabel={`Imagen de la rutina ${rutina.rut_nom}`}
                        />
                    </View>
                    <View style={styles.textosHeader}>
                        <Text style={styles.tituloRutina}>{rutina.rut_nom}</Text>
                        <Text style={styles.descripcionRutina}>{rutina.rut_desc}</Text>
                    </View>
                </View>

                {/* Progreso */}
                <View style={styles.contenedorProgreso}>
                    <View style={styles.progresoRow}>
                        <Text style={styles.textoProgreso}>Tu progreso</Text>
                        <Text style={styles.textoPorcentaje}>{porcentajeSafe}%</Text>
                    </View>
                    <View style={styles.barraFondo}>
                        <View style={[styles.barraRelleno, { width: `${porcentajeSafe}%` }]} />
                    </View>
                    <Text style={styles.textoContador}>
                        {progreso.prog_ejercicios_completados} de {progreso.prog_ejercicios_total} ejercicios completados
                    </Text>
                </View>

                {/* Botón continuar */}
                <TouchableOpacity
                    style={styles.botonContinuar}
                    onPress={handleContinuar}
                    accessibilityLabel={progreso.prog_completada ? 'Repetir rutina desde el inicio' : 'Continuar con el siguiente ejercicio'}
                    accessibilityRole="button"
                >
                    <Ionicons
                        name={progreso.prog_completada ? 'refresh' : 'play'}
                        size={16}
                        color="#9b1b6e"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={styles.textoBoton}>
                        {progreso.prog_completada ? 'Repetir rutina' : 'Continuar'}
                    </Text>
                </TouchableOpacity>

                {/* Lista de ejercicios */}
                <Text style={styles.seccionTitulo}>Ejercicios</Text>
                <View style={styles.contenedorLista}>
                    {rutina.rutina_eje.map((item, index) => {
                        const isCompleted = ejerciciosCompletados.has(item.ejercicios.id_eje);
                        const isActive = !isCompleted && index === rutina.rutina_eje.findIndex(e => !ejerciciosCompletados.has(e.ejercicios.id_eje));
                        return (
                            <TouchableOpacity
                                key={item.id_re}
                                style={[
                                    styles.cajaEjercicio,
                                    isActive && styles.cajaActiva,
                                    isCompleted && styles.cajaCompletada,
                                ]}
                                onPress={() => router.push(`/ejercicio/${item.id_re}` as any)}
                                accessibilityLabel={`Ejercicio ${index + 1}: ${item.ejercicios.eje_nom}${isCompleted ? ', completado' : isActive ? ', activo' : ''}`}
                                accessibilityRole="button"
                            >
                                <View style={styles.cajaRow}>
                                    <View style={[styles.numeroBadge, isActive && styles.numeroBadgeActivo, isCompleted && styles.numeroBadgeCompleto]}>
                                        {isCompleted
                                            ? <Ionicons name="checkmark" size={14} color="#fff" />
                                            : <Text style={styles.numeroTexto}>{index + 1}</Text>
                                        }
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.nombreEjercicio,
                                            isActive && styles.textoActivo,
                                            isCompleted && styles.textoCompletado,
                                        ]}>
                                            {item.ejercicios.eje_nom}
                                        </Text>
                                        <Text style={styles.metaEjercicio}>
                                            {item.ejercicios.repeticiones} reps · {item.ejercicios.duracion}s
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={isCompleted ? '#ccc' : '#9b1b6e'}
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    centrado: { justifyContent: 'center', alignItems: 'center' },

    btnAtras: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
    },
    btnAtrasTexto: { fontSize: 15, color: '#9b1b6e', fontWeight: '600' },

    contenido: { padding: 20 },
    textoZona: { fontSize: 13, color: '#9b1b6e', fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
    seccionTitulo: { fontSize: 16, fontWeight: '700', color: '#3d0030', marginBottom: 12, marginTop: 8 },

    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    contenedorImagen: { width: 100, height: 120, borderRadius: 12, borderWidth: 1, borderColor: '#e8a0d0', overflow: 'hidden', marginRight: 15 },
    imagenRutina: { width: '100%', height: '100%', backgroundColor: '#fce4f3' },
    textosHeader: { flex: 1, justifyContent: 'center' },
    tituloRutina: { fontSize: 20, fontWeight: 'bold', color: '#3d0030', marginBottom: 8 },
    descripcionRutina: { fontSize: 14, color: '#3d0030', lineHeight: 20 },

    contenedorProgreso: { marginBottom: 20, backgroundColor: '#fdf4fb', borderRadius: 12, padding: 14 },
    progresoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    textoProgreso: { fontSize: 14, color: '#c48aa9', fontWeight: '600' },
    textoPorcentaje: { fontSize: 14, fontWeight: '800', color: '#9b1b6e' },
    barraFondo: { height: 10, backgroundColor: '#fdebf7', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
    barraRelleno: { height: '100%', backgroundColor: '#9b1b6e', borderRadius: 5 },
    textoContador: { fontSize: 12, color: '#888', textAlign: 'right' },

    botonContinuar: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
        borderWidth: 1.5, borderColor: '#9b1b6e',
        alignSelf: 'flex-start', marginBottom: 24,
    },
    textoBoton: { color: '#9b1b6e', fontWeight: 'bold', fontSize: 14 },

    contenedorLista: { gap: 10 },
    cajaEjercicio: {
        backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8a0d0',
        paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10,
    },
    cajaActiva: { borderColor: '#9b1b6e', borderWidth: 1.5, backgroundColor: '#fdebf7' },
    cajaCompletada: { backgroundColor: '#f9f9f9', borderColor: '#eee' },
    cajaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

    numeroBadge: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#fce4f3', justifyContent: 'center', alignItems: 'center',
    },
    numeroBadgeActivo: { backgroundColor: '#9b1b6e' },
    numeroBadgeCompleto: { backgroundColor: '#5cb85c' },
    numeroTexto: { fontSize: 12, fontWeight: '700', color: '#9b1b6e' },

    nombreEjercicio: { fontSize: 15, color: '#3d0030', fontWeight: '500' },
    textoActivo: { color: '#9b1b6e', fontWeight: '700' },
    textoCompletado: { color: '#a0a0a0', textDecorationLine: 'line-through' },
    metaEjercicio: { fontSize: 12, color: '#aaa', marginTop: 2 },

    emptyText: { color: '#c48aa9' },
});
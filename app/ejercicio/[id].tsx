import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    TouchableOpacity, ScrollView, Alert, Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '../../src/services/supabase';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Tipos ────────────────────────────────────────────────────────────────────
type DetalleEjercicio = {
    id_re:   string;
    id_rut:  string;
    re_rep:  number;
    re_dur:  number;
    re_ord:  number;
    ejercicios: {
        id_eje:   string;
        eje_nom:  string;
        eje_desc: string;
        eje_video: string;
        repeticiones:string;
        duracion:string;
    };
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function EjecucionScreen() {
    const { id }  = useLocalSearchParams();
    const router  = useRouter();

    const [detalle,      setDetalle]     = useState<DetalleEjercicio | null>(null);
    const [loading,      setLoading]     = useState(true);
    const [actualizando, setActualizando] = useState(false);
    const [userId,       setUserId]      = useState<string | null>(null);

    const urlVideo  = detalle?.ejercicios?.eje_video || '';
    const idYoutube = extraerIdYoutube(urlVideo);
    const esYoutube = idYoutube !== null;

    // Obtener usuario
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id);
        });
    }, []);

    useEffect(() => {
        if (id) fetchDetalle();
    }, [id]);

    function extraerIdYoutube(url: string) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match  = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    const fetchDetalle = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('rutina_eje')
                .select(`id_re, id_rut, re_rep, re_dur, re_ord,
                         ejercicios(id_eje, eje_nom, eje_desc, eje_video, repeticiones, duracion)`)
                .eq('id_re', id)
                .single();

            if (error) throw error;
            if (data) setDetalle(data as unknown as DetalleEjercicio);
        } catch (error) {
            console.error('Error al cargar ejercicio', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Marcar ejercicio completado ───────────────────────────────────────────
    const handleCompletar = async () => {
        if (!detalle || !userId) return;
        try {
            setActualizando(true);

            // 1. Registrar sesión
            await supabase.from('sesion').insert({
                id_us:              userId,
                id_rut:             detalle.id_rut,
                id_eje:             detalle.ejercicios.id_eje,
                se_dur:             detalle.re_dur,
                se_completado:      true,
                se_objetivo_logrado: 'Completado desde la app',
            });

            // 2. Obtener los IDs válidos de esta rutina
            const { data: rutinaEjes } = await supabase
                .from('rutina_eje')
                .select('id_eje')
                .eq('id_rut', detalle.id_rut);
                
            const validIds = new Set(rutinaEjes?.map(r => r.id_eje) ?? []);
            const total = validIds.size || 1;

            // 3. Obtener sesiones y filtrarlas estrictamente
            const { data: sesionesUnicas } = await supabase
                .from('sesion')
                .select('id_eje')
                .eq('id_us', userId)
                .eq('id_rut', detalle.id_rut)
                .eq('se_completado', true);

            const completadosFinales = new Set(
                sesionesUnicas?.map(s => s.id_eje).filter(id => validIds.has(id)) ?? []
            ).size;

            const porcentajeFinal = Math.round((completadosFinales / total) * 100);

            // 4. Buscar progreso FILTRADO por usuario
            const { data: progresoInfo } = await supabase
                .from('progreso_rutina')
                .select('*')
                .eq('id_rut', detalle.id_rut)
                .eq('id_us', userId)
                .maybeSingle();

            if (!progresoInfo) {
                // Primera vez que completa un ejercicio de esta rutina
                await supabase.from('progreso_rutina').insert({
                    id_rut:                      detalle.id_rut,
                    id_us:                       userId,
                    prog_ejercicios_completados: completadosFinales,
                    prog_ejercicios_total:       total,
                    prog_porcentaje:             porcentajeFinal,
                    prog_completada:             completadosFinales >= total,
                });
            } else {
                // Actualizar el progreso existente
                await supabase
                    .from('progreso_rutina')
                    .update({
                        prog_ejercicios_completados: completadosFinales,
                        prog_ejercicios_total:       total,
                        prog_porcentaje:             porcentajeFinal,
                        prog_completada:             completadosFinales >= total,
                    })
                    .eq('id_prog', progresoInfo.id_prog);
            }
            
            router.back();
        } catch (error) {
            console.error('Error al actualizar progreso:', error);
            Alert.alert('Error', 'No se pudo guardar el progreso.');
        } finally {
            setActualizando(false);
        }
    };

    const irAPracticaIA = () => {
        if (!detalle) return;
        router.push({
            pathname: '/practicaIA' as any,
            params: {
                id_eje:       detalle.ejercicios.id_eje,
                id_rut:       detalle.id_rut,
                id_re:        detalle.id_re,
                duracion:     detalle.ejercicios.duracion,
                repeticiones: detalle.ejercicios.repeticiones,
            },
        });
    };

    // ── Reproductor ───────────────────────────────────────────────────────────
    const renderReproductor = () => {
        if (!urlVideo) {
            return (
                <View style={[styles.video, styles.centrado, { backgroundColor: '#e8a0d0' }]}>
                    <Ionicons name="videocam-off-outline" size={36} color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 8 }}>Video no disponible</Text>
                </View>
            );
        }
        if (esYoutube) {
            return (
                <YoutubeIframe
                    height={250}
                    width={SCREEN_WIDTH}
                    videoId={idYoutube}
                    play={false}
                />
            );
        }
        return (
            <Video
                style={styles.video}
                source={{ uri: urlVideo }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping
            />
        );
    };

    // ── Loading / Error ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.container, styles.centrado]}>
                <ActivityIndicator size="large" color="#9b1b6e" />
            </View>
        );
    }

    if (!detalle) {
        return (
            <View style={[styles.container, styles.centrado]}>
                <Text style={{ color: '#c48aa9' }}>Ejercicio no encontrado</Text>
            </View>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <Stack.Screen options={{ title: detalle.ejercicios.eje_nom, headerBackTitle: 'Rutina' }} />

            {/* Botón atrás explícito */}
            <TouchableOpacity
                style={styles.btnAtras}
                onPress={() => router.back()}
                accessibilityLabel="Regresar a la rutina"
                accessibilityRole="button"
            >
                <Ionicons name="arrow-back" size={20} color="#9b1b6e" />
                <Text style={styles.btnAtrasTexto}>Volver a la rutina</Text>
            </TouchableOpacity>

            {/* Video */}
            <View style={styles.contenedorVideo}>
                {renderReproductor()}
            </View>

            <View style={styles.contenido}>
                <Text style={styles.titulo}>{detalle.ejercicios.eje_nom}</Text>

                {/* Métricas */}
                <View style={styles.metricasContainer}>
                    <View style={styles.cajaMetrica}>
                        <Ionicons name="repeat" size={20} color="#9b1b6e" style={{ marginBottom: 4 }} />
                        <Text style={styles.metricaValor}>{detalle.ejercicios.repeticiones}</Text>
                        <Text style={styles.metricaLabel}>Repeticiones</Text>
                    </View>
                    <View style={styles.cajaMetrica}>
                        <Ionicons name="time-outline" size={20} color="#9b1b6e" style={{ marginBottom: 4 }} />
                        <Text style={styles.metricaValor}>{detalle.ejercicios.duracion}s</Text>
                        <Text style={styles.metricaLabel}>Duración</Text>
                    </View>
                </View>

                <Text style={styles.descripcion}>{detalle.ejercicios.eje_desc}</Text>

                {/* Botones de acción */}
                <View style={styles.botonesContainer}>
                    {/* Práctica con IA */}
                    <TouchableOpacity
                        style={styles.botonIA}
                        onPress={irAPracticaIA}
                        disabled={actualizando}
                        accessibilityLabel="Comenzar práctica con inteligencia artificial"
                        accessibilityRole="button"
                    >
                        <Ionicons name="sparkles-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.textoBotonIA}>Práctica con IA</Text>
                    </TouchableOpacity>

                    {/* Completar manualmente */}
                    <TouchableOpacity
                        style={[styles.botonCompletar, actualizando && { opacity: 0.6 }]}
                        onPress={handleCompletar}
                        disabled={actualizando}
                        accessibilityLabel="Marcar ejercicio como completado"
                        accessibilityRole="button"
                    >
                        {actualizando
                            ? <ActivityIndicator color="#9b1b6e" size="small" />
                            : <>
                                <Ionicons name="checkmark-circle-outline" size={18} color="#9b1b6e" style={{ marginRight: 6 }} />
                                <Text style={styles.textoBotonCompletar}>Marcar como completado</Text>
                              </>
                        }
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    centrado:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

    btnAtras: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4,
    },
    btnAtrasTexto: { fontSize: 15, color: '#9b1b6e', fontWeight: '600' },

    contenedorVideo: { width: '100%', height: 250, backgroundColor: '#000' },
    video:           { width: '100%', height: '100%' },

    contenido:   { padding: 20 },
    titulo:      { fontSize: 24, fontWeight: 'bold', color: '#3d0030', marginBottom: 20 },

    metricasContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
    cajaMetrica: {
        flex: 1, backgroundColor: '#fdebf7', padding: 15, borderRadius: 12,
        alignItems: 'center', borderWidth: 1, borderColor: '#fce4f3',
    },
    metricaValor: { fontSize: 22, fontWeight: 'bold', color: '#9b1b6e', marginBottom: 4 },
    metricaLabel: { fontSize: 12, color: '#c48aa9', textTransform: 'uppercase', fontWeight: '600' },

    descripcion: { fontSize: 16, color: '#3d0030', lineHeight: 24, marginBottom: 28 },

    botonesContainer: { gap: 12 },

    botonIA: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#9b1b6e', paddingVertical: 16, borderRadius: 12,
        shadowColor: 'rgba(155,27,110,0.35)',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4,
    },
    textoBotonIA: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    botonCompletar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#fce4f3', paddingVertical: 14, borderRadius: 12,
        borderWidth: 1.5, borderColor: '#9b1b6e',
    },
    textoBotonCompletar: { color: '#9b1b6e', fontSize: 15, fontWeight: '700' },
});
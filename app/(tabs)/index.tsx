import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, ImageBackground, Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/services/supabase';

const { width } = Dimensions.get('window');

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Fisioterapeuta = { nombre: string; apellido_paterno: string };

type CitaRaw = {
    id: string;
    fecha: string;
    hora_inicio: string;
    motivo: string;
    estado: string;
    // Supabase devuelve las relaciones como array en el tipo inferido
    fisioterapeutas?: Fisioterapeuta | Fisioterapeuta[] | null;
};

type Cita = {
    id: string;
    fecha: string;
    hora_inicio: string;
    motivo: string;
    estado: string;
    fisioterapeutas?: Fisioterapeuta | null;
};

/** Normaliza la relación fisioterapeutas (array o objeto) a un único objeto */
function normalizarCita(raw: CitaRaw): Cita {
    const fisio = Array.isArray(raw.fisioterapeutas)
        ? raw.fisioterapeutas[0] ?? null
        : raw.fisioterapeutas ?? null;
    return { ...raw, fisioterapeutas: fisio };
}

type Rutina = {
    id_rut: string;
    rut_nom: string;
    rut_zona: string;
    prog_porcentaje?: number;
};

// ─── Datos de atajos ──────────────────────────────────────────────────────────
const ATAJOS = [
    { label: 'Mis Citas',    icon: 'calendar',          ruta: '/MisCitas',       color: '#9b1b6e' },
    { label: 'Rutinas',      icon: 'body',               ruta: '/rutinas',        color: '#c0397a' },
    { label: 'Mis Rutinas',  icon: 'list-circle',        ruta: '/mis_rutinas',    color: '#7a1257' },
    { label: 'Historial',    icon: 'time',               ruta: '/HistorialCitas', color: '#b02f72' },
    { label: 'Chat',         icon: 'chatbubbles',        ruta: '/ChatMotriCare',  color: '#e04c96' },
    { label: 'Agendar Cita',         icon: 'card',               ruta: '/pago',           color: '#8c155f' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatearFecha(fecha: string) {
    const [year, mes, dia] = fecha.split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${dia} ${meses[parseInt(mes, 10) - 1]} ${year}`;
}

function saludar() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function HomeScreen() {
    const router = useRouter();

    const [nombreUsuario, setNombreUsuario]   = useState('');
    const [proximaCita, setProximaCita]       = useState<Cita | null>(null);
    const [rutinaActiva, setRutinaActiva]     = useState<Rutina | null>(null);
    const [totalCitas, setTotalCitas]         = useState(0);
    const [loading, setLoading]               = useState(true);

    useFocusEffect(
        useCallback(() => {
            cargarDatos();
        }, [])
    );

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Perfil del usuario
            const { data: perfil } = await supabase
                .from('usuario')
                .select('us_nom')
                .eq('id_us', user.id)
                .single();

            if (perfil) {
                setNombreUsuario(`${perfil.us_nom}`);
            }

            // Próxima cita
            const hoy = new Date().toISOString().split('T')[0];
            const { data: citas } = await supabase
                .from('citas')
                .select(`id, fecha, hora_inicio, motivo, estado,
                         fisioterapeutas ( nombre, apellido_paterno )`)
                .eq('usuario_id', user.id)
                .neq('estado', 'cancelada')
                .gte('fecha', hoy)
                .order('fecha', { ascending: true })
                .limit(3);

            setProximaCita(citas?.[0] ? normalizarCita(citas[0] as CitaRaw) : null);
            setTotalCitas(citas?.length ?? 0);

            // Rutina con mayor progreso activa
            const { data: progresos } = await supabase
                .from('progreso_rutina')
                .select(`prog_porcentaje, rutina(id_rut, rut_nom, rut_zona)`)
                .eq('id_us', user.id)
                .eq('prog_completada', false)
                .gt('prog_porcentaje', 0)
                .order('prog_porcentaje', { ascending: false })
                .limit(1);

            if (progresos?.[0]?.rutina) {
                const r = progresos[0].rutina as any;
                setRutinaActiva({ ...r, prog_porcentaje: progresos[0].prog_porcentaje });
            }
        } catch (e) {
            console.log('Error home:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={estilos.loadingContainer}>
                <ActivityIndicator size="large" color="#9b1b6e" />
                <Text style={estilos.loadingText}>Cargando tu espacio…</Text>
            </View>
        );
    }

    const primerNombre = nombreUsuario.split(' ')[0] || 'Usuario';

    return (
        <ScrollView style={estilos.scroll} contentContainerStyle={estilos.contenido} showsVerticalScrollIndicator={false}>

            {/* ── Bienvenida ─────────────────────────────── */}
            <LinearGradient
                colors={['#9b1b6e', '#c0397a', '#e04c96']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={estilos.banner}
            >
                {/* Círculos decorativos */}
                <View style={estilos.circulo1} />
                <View style={estilos.circulo2} />

                <View style={estilos.bannerContent}>
                    <Text style={estilos.saludo}>{saludar()},</Text>
                    <Text style={estilos.nombre}>{primerNombre} 👋</Text>
                    <Text style={estilos.subtitulo}>Tu bienestar es nuestra prioridad</Text>
                </View>

                {/* Stats rápidos */}
                <View style={estilos.statsRow}>
                    <View style={estilos.statItem}>
                        <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.9)" />
                        <Text style={estilos.statNum}>{totalCitas}</Text>
                        <Text style={estilos.statLabel}>Citas</Text>
                    </View>
                    <View style={estilos.statDivider} />
                    <View style={estilos.statItem}>
                        <Ionicons name="fitness-outline" size={18} color="rgba(255,255,255,0.9)" />
                        <Text style={estilos.statNum}>{rutinaActiva ? '1' : '0'}</Text>
                        <Text style={estilos.statLabel}>En progreso</Text>
                    </View>
                    <View style={estilos.statDivider} />
                    <View style={estilos.statItem}>
                        <Ionicons name="chatbubbles-outline" size={18} color="rgba(255,255,255,0.9)" />
                        <Text style={estilos.statNum}>Chat</Text>
                        <Text style={estilos.statLabel}>Disponible</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* ── Próxima cita ───────────────────────────── */}
            <View style={estilos.seccion}>
                <Text style={estilos.seccionTitulo}>Próxima Cita</Text>

                {proximaCita ? (
                    <TouchableOpacity
                        style={estilos.citaCard}
                        onPress={() => router.push('/MisCitas')}
                        activeOpacity={0.85}
                    >
                        <View style={estilos.citaIcono}>
                            <Ionicons name="calendar" size={26} color="#9b1b6e" />
                        </View>
                        <View style={estilos.citaInfo}>
                            <Text style={estilos.citaFecha}>
                                {formatearFecha(proximaCita.fecha)} · {proximaCita.hora_inicio}
                            </Text>
                            <Text style={estilos.citaMotivo} numberOfLines={1}>
                                {proximaCita.motivo}
                            </Text>
                            {proximaCita.fisioterapeutas && (
                                <Text style={estilos.citaFisio}>
                                    Fisioterap.: {proximaCita.fisioterapeutas.nombre} {proximaCita.fisioterapeutas.apellido_paterno}
                                </Text>
                            )}
                        </View>
                        <View style={[estilos.estadoBadge,
                            proximaCita.estado === 'confirmada'
                                ? estilos.estadoConfirmada
                                : estilos.estadoPendiente
                        ]}>
                            <Text style={estilos.estadoTexto}>{proximaCita.estado}</Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={estilos.citaVacia}
                        onPress={() => router.push('/pago')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="calendar-outline" size={32} color="#c0397a" />
                        <Text style={estilos.citaVaciaTexto}>No tienes citas próximas</Text>
                        <Text style={estilos.citaVaciaAccion}>Agendar una cita →</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Rutina en progreso ─────────────────────── */}
            {rutinaActiva && (
                <View style={estilos.seccion}>
                    <Text style={estilos.seccionTitulo}>Rutina en Progreso</Text>
                    <TouchableOpacity
                        style={estilos.rutinaCard}
                        onPress={() => router.push('/mis_rutinas')}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#fce4f3', '#fff0f8']}
                            style={estilos.rutinaGradient}
                        >
                            <View style={estilos.rutinaHeader}>
                                <Ionicons name="body" size={22} color="#9b1b6e" />
                                <Text style={estilos.rutinaNombre} numberOfLines={1}>
                                    {rutinaActiva.rut_nom}
                                </Text>
                            </View>
                            <Text style={estilos.rutinaZona}>📍 {rutinaActiva.rut_zona}</Text>

                            {/* Barra de progreso */}
                            <View style={estilos.progresoContainer}>
                                <View style={estilos.progresoBg}>
                                    <View
                                        style={[
                                            estilos.progresoFill,
                                            { width: `${rutinaActiva.prog_porcentaje ?? 0}%` }
                                        ]}
                                    />
                                </View>
                                <Text style={estilos.progresoPct}>
                                    {rutinaActiva.prog_porcentaje ?? 0}%
                                </Text>
                            </View>

                            <Text style={estilos.continuar}>Continuar →</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Atajos rápidos ─────────────────────────── */}
            <View style={estilos.seccion}>
                <Text style={estilos.seccionTitulo}>Accesos Rápidos</Text>
                <View style={estilos.atajosGrid}>
                    {ATAJOS.map((a) => (
                        <TouchableOpacity
                            key={a.ruta}
                            style={estilos.atajoItem}
                            onPress={() => router.push(a.ruta as any)}
                            activeOpacity={0.75}
                        >
                            <View style={[estilos.atajoIcono, { backgroundColor: a.color + '18' }]}>
                                <Ionicons name={a.icon as any} size={26} color={a.color} />
                            </View>
                            <Text style={estilos.atajoLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ── Botón Chat IA ──────────────────────────── */}
            <View style={[estilos.seccion, { marginBottom: 32 }]}>
                <TouchableOpacity
                    style={estilos.chatBtn}
                    onPress={() => router.push('/ChatMotriCare')}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#9b1b6e', '#e04c96']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={estilos.chatGradient}
                    >
                        <Ionicons name="chatbubbles" size={22} color="#fff" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={estilos.chatTitulo}>Chat MotriCare</Text>
                            <Text style={estilos.chatSub}>Habla con tu fisioterapeuta ahora</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

        </ScrollView>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const estilos = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: '#fafafa' },
    contenido: { paddingBottom: 20 },

    loadingContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa', gap: 12,
    },
    loadingText: { color: '#9b1b6e', fontSize: 14 },

    // Banner
    banner: {
        paddingTop: 36,
        paddingHorizontal: 24,
        paddingBottom: 28,
        overflow: 'hidden',
    },
    circulo1: {
        position: 'absolute', width: 200, height: 200,
        borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)',
        top: -60, right: -50,
    },
    circulo2: {
        position: 'absolute', width: 140, height: 140,
        borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)',
        bottom: -30, left: 20,
    },
    bannerContent: { marginBottom: 20 },
    saludo: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '400' },
    nombre: { fontSize: 28, color: '#fff', fontWeight: '800', marginTop: 2 },
    subtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

    statsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 3 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
    statNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)' },

    // Secciones
    seccion: { paddingHorizontal: 20, marginTop: 24 },
    seccionTitulo: { fontSize: 16, fontWeight: '700', color: '#3d0030', marginBottom: 12 },

    // Cita card
    citaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        gap: 12,
        shadowColor: '#9b1b6e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    citaIcono: {
        width: 50, height: 50, borderRadius: 12,
        backgroundColor: '#fce4f3',
        justifyContent: 'center', alignItems: 'center',
    },
    citaInfo: { flex: 1 },
    citaFecha: { fontSize: 13, fontWeight: '700', color: '#3d0030' },
    citaMotivo: { fontSize: 12, color: '#888', marginTop: 2 },
    citaFisio: { fontSize: 11, color: '#9b1b6e', marginTop: 3 },
    estadoBadge: {
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    },
    estadoConfirmada: { backgroundColor: '#e6f9f0' },
    estadoPendiente: { backgroundColor: '#fff3e0' },
    estadoTexto: { fontSize: 10, fontWeight: '600', color: '#555', textTransform: 'capitalize' },

    citaVacia: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        gap: 6,
        borderWidth: 1.5,
        borderColor: '#fce4f3',
        borderStyle: 'dashed',
    },
    citaVaciaTexto: { fontSize: 14, color: '#888', marginTop: 4 },
    citaVaciaAccion: { fontSize: 13, color: '#9b1b6e', fontWeight: '600' },

    // Rutina
    rutinaCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#9b1b6e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    rutinaGradient: { padding: 16 },
    rutinaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    rutinaNombre: { flex: 1, fontSize: 15, fontWeight: '700', color: '#3d0030' },
    rutinaZona: { fontSize: 12, color: '#888', marginBottom: 12 },
    progresoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    progresoBg: {
        flex: 1, height: 8, borderRadius: 4,
        backgroundColor: 'rgba(155,27,110,0.15)',
        overflow: 'hidden',
    },
    progresoFill: {
        height: '100%', borderRadius: 4, backgroundColor: '#9b1b6e',
    },
    progresoPct: { fontSize: 12, fontWeight: '700', color: '#9b1b6e', minWidth: 36 },
    continuar: { fontSize: 13, color: '#9b1b6e', fontWeight: '600', textAlign: 'right' },

    // Atajos
    atajosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    atajoItem: {
        width: (width - 40 - 36) / 3,
        alignItems: 'center',
        gap: 6,
    },
    atajoIcono: {
        width: '100%', aspectRatio: 1,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    atajoLabel: { fontSize: 11, color: '#3d0030', fontWeight: '500', textAlign: 'center' },

    // Chat CTA
    chatBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#9b1b6e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    chatGradient: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 16, paddingHorizontal: 20,
    },
    chatTitulo: { fontSize: 15, fontWeight: '700', color: '#fff' },
    chatSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});
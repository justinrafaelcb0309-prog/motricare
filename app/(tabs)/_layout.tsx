import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Modal, SafeAreaView, Pressable
} from 'react-native';

function MenuLateral({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const router = useRouter();

    const opciones = [
        { label: 'Inicio', icon: 'home-outline', ruta: '/' },
        { label: 'Rutinas', icon: 'body-outline', ruta: '/rutinas' },
        { label: 'Mis rutinas', icon: 'list-outline', ruta: '/mis_rutinas' },
        { label: 'Chat', icon: 'chatbubbles-outline', ruta: '/ChatMotriCare' },
        { label: 'Mis citas', icon: 'calendar-outline', ruta: '/MisCitas' },
        { label: 'Historial de citas', icon: 'time-outline', ruta: '/HistorialCitas' },
        { label: 'Agendar cita', icon: 'card-outline', ruta: '/pago' },
        { label: 'Mi perfil', icon: 'person-outline', ruta: '/account' },
    ];

    const navegar = (ruta: string) => {
        onClose();
        router.navigate(ruta as any);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={estilos.overlay} onPress={onClose} />
            <SafeAreaView style={estilos.drawer}>
                <View style={estilos.drawerHeader}>
                    <Text style={estilos.drawerTitulo}>MotriCare</Text>
                    <TouchableOpacity onPress={onClose} style={estilos.cerrarBtn}>
                        <Ionicons name="close" size={24} color="#9b1b6e" />
                    </TouchableOpacity>
                </View>

                <View style={estilos.drawerLinea} />

                {opciones.map((op) => (
                    <TouchableOpacity
                        key={op.ruta}
                        style={estilos.opcion}
                        onPress={() => navegar(op.ruta)}
                    >
                        <Ionicons name={op.icon as any} size={22} color="#9b1b6e" />
                        <Text style={estilos.opcionTexto}>{op.label}</Text>
                    </TouchableOpacity>
                ))}
            </SafeAreaView>
        </Modal>
    );
}

export default function TabLayout() {
    const [menuVisible, setMenuVisible] = useState(false);

    const botonMenu = () => (
        <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={{ marginLeft: 16 }}
        >
            <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
    );

    return (
        <>
            <MenuLateral visible={menuVisible} onClose={() => setMenuVisible(false)} />

            <Tabs screenOptions={{
                tabBarActiveTintColor: '#9b1b6e',
                tabBarInactiveTintColor: '#888888',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#fce4f3',
                    paddingBottom: 5,
                    height: 60,
                },
                tabBarLabelStyle: { fontSize: 10 },
                headerStyle: { backgroundColor: '#9b1b6e' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
                headerLeft: botonMenu,
            }}>

                {/* ── 4 pestañas principales visibles ── */}
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Inicio',
                        tabBarIcon: ({color}) => <Ionicons name='home' size={24} color={color}/>,   // ← oculto del tab bar, pero la ruta "/" sí funciona
                    }}
                />
                <Tabs.Screen
                    name="rutinas"
                    options={{
                        title: 'Rutinas',
                        tabBarIcon: ({ color }) => <Ionicons name="body" size={24} color={color} />,
                    }}
                />
                <Tabs.Screen
                    name="mis_rutinas"
                    options={{
                        title: 'Mis Rutinas',
                        tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} />,
                    }}
                />
                <Tabs.Screen
                    name="ChatMotriCare"
                    options={{
                        title: 'Chat Motricare',
                        tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={24} color={color} />,
                    }}
                />
                <Tabs.Screen
                    name="account"
                    options={{
                        title: 'Perfil',
                        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
                    }}
                />

                {/* ── Ocultas del tab bar, accesibles desde el menú ── */}
                <Tabs.Screen name="pago" options={{ title: "Agendar cita", href: null }} />
                <Tabs.Screen name="HistorialCitas" options={{ title: "Historial de Citas", href: null }} />
                <Tabs.Screen name="MisCitas" options={{ title: "Mis Citas", href: null }} />
                <Tabs.Screen name="modal" options={{ href: null }} />
            </Tabs>
        </>
    );
}

const estilos = StyleSheet.create({
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    drawer: {
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: 270,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 20,
        elevation: 10,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    drawerTitulo: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#9b1b6e',
    },
    cerrarBtn: { padding: 4 },
    drawerLinea: {
        height: 0.5,
        backgroundColor: '#fce4f3',
        marginBottom: 12,
    },
    opcion: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: '#fce4f3',
    },
    opcionTexto: {
        fontSize: 16,
        color: '#3d0030',
    },
});
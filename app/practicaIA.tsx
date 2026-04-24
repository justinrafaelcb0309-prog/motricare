import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { supabase } from '../src/services/supabase';

// Índices de landmarks de MediaPipe Pose
const DICCIONARIO_ARTICULACIONES: Record<string, number[]> = {
    codo_izq: [11, 13, 15],
    codo_der: [12, 14, 16],
    rodilla_izq: [23, 25, 27],
    rodilla_der: [24, 26, 28],
    cadera_izq: [11, 23, 25],
    cadera_der: [12, 24, 26],
};

const MEDIAPIPE_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>* { margin:0; padding:0; } body { background: transparent; }</style>
</head>
<body>
<img id="frame" style="display:none"/>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js" crossorigin="anonymous"></script>
<script>
let pose = null;
let ready = false;
let procesando = false;

function send(data) {
  window.ReactNativeWebView.postMessage(JSON.stringify(data));
}

function init() {
  pose = new Pose({
    locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/' + file
  });
  pose.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  pose.onResults((results) => {
    procesando = false;
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      send({ type: 'landmarks', landmarks: results.poseLandmarks });
    } else {
      send({ type: 'no_pose' });
    }
  });
  pose.initialize().then(() => {
    ready = true;
    send({ type: 'ready' });
  }).catch((e) => {
    send({ type: 'error', msg: String(e) });
  });
}

function onMessage(event) {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'frame' && ready && !procesando) {
      procesando = true;
      const img = document.getElementById('frame');
      img.onload = () => {
        pose.send({ image: img }).catch(() => { procesando = false; });
      };
      img.onerror = () => { procesando = false; };
      img.src = 'data:image/jpeg;base64,' + data.base64;
    }
  } catch(e) {
    procesando = false;
  }
}

document.addEventListener('message', onMessage);
window.addEventListener('message', onMessage);
init();
</script>
</body>
</html>
`;

function calcularAngulo(p1: any, p2: any, p3: any): number {
    const rad =
        Math.atan2(p3.y - p2.y, p3.x - p2.x) -
        Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angulo = Math.abs(rad * (180 / Math.PI));
    if (angulo > 180) angulo = 360 - angulo;
    return angulo;
}

export default function PracticaIA() {
    const router = useRouter();
    const { id_eje, id_rut, duracion, repeticiones } = useLocalSearchParams();

    const [permission, requestPermission] = useCameraPermissions();
    const [modeloListo, setModeloListo] = useState(false);
    const [status, setStatus] = useState('Cargando modelo de IA...');
    const [repFaltantes, setRepFaltantes] = useState(Number(repeticiones) || 5);
    const [completado, setCompletado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [nombreEjercicio, setNombreEjercicio] = useState('');

    const cameraRef = useRef<CameraView>(null);
    const webviewRef = useRef<WebView>(null);
    const faseRef = useRef(0);
    const repRef = useRef(Number(repeticiones) || 5);
    const metaRef = useRef<any>(null);
    const completadoRef = useRef(false);
    const guardandoRef = useRef(false);
    const capturandoRef = useRef(false);
    const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!permission?.granted) requestPermission();
    }, []);

    useEffect(() => {
        async function cargarEjercicio() {
            if (!id_eje) return;
            const { data } = await supabase
                .from('ejercicios')
                .select('angulos_meta, articulacion_objetivo, eje_nom')
                .eq('id_eje', id_eje)
                .single();
            if (data?.angulos_meta) {
                metaRef.current = data;
                setNombreEjercicio(data.eje_nom);
            } else {
                setStatus('Error al cargar ejercicio.');
            }
        }
        cargarEjercicio();
        return () => {
            if (intervaloRef.current) clearInterval(intervaloRef.current);
        };
    }, [id_eje]);

    const arrancarCaptura = () => {
        if (intervaloRef.current) clearInterval(intervaloRef.current);
        intervaloRef.current = setInterval(capturarFrame, 250);
    };

    const capturarFrame = async () => {
        if (
            capturandoRef.current ||
            completadoRef.current ||
            guardandoRef.current ||
            !cameraRef.current ||
            !webviewRef.current ||
            !metaRef.current
        ) return;

        capturandoRef.current = true;
        try {
            const foto = await cameraRef.current.takePictureAsync({
                quality: 0.3,
                base64: true,
                skipProcessing: true,
            });
            if (foto?.base64) {
                console.log('📤 Enviando frame al WebView, tamaño:', foto.base64.length);
                webviewRef.current.postMessage(JSON.stringify({
                    type: 'frame',
                    base64: foto.base64,
                }));
            }
        } catch {
            // silencioso
        } finally {
            capturandoRef.current = false;
        }
    };

    const handleWebViewMessage = (event: any) => {
        try {
            const msg = JSON.parse(event.nativeEvent.data);
            console.log('📨 WebView mensaje:', msg.type, msg.type === 'error' ? msg.msg : '');
            if (msg.type === 'ready') {
                setModeloListo(true);
                setStatus('¡Listo! Colócate en posición inicial.');
                arrancarCaptura();
            } else if (msg.type === 'no_pose') {
                setStatus('Buscando tu cuerpo...');
            } else if (msg.type === 'error') {
                setStatus('Error al cargar MediaPipe.');
            } else if (msg.type === 'landmarks') {
                procesarLandmarks(msg.landmarks);
            }
        } catch {
            // silencioso
        }
    };

    const procesarLandmarks = (landmarks: any[]) => {
        const meta = metaRef.current;
        if (!meta || completadoRef.current || guardandoRef.current) return;

        const { angulos_meta, articulacion_objetivo } = meta;
        const indices = DICCIONARIO_ARTICULACIONES[articulacion_objetivo];
        if (!indices) { setStatus('Articulación no configurada.'); return; }

        const p1 = landmarks[indices[0]];
        const p2 = landmarks[indices[1]];
        const p3 = landmarks[indices[2]];

        if ((p1?.visibility ?? 0) < 0.5 || (p2?.visibility ?? 0) < 0.5 || (p3?.visibility ?? 0) < 0.5) {
            setStatus('Buscando tu cuerpo...');
            return;
        }

        const angulo = calcularAngulo(p1, p2, p3);
        const { angulo_reposo, angulo_contraccion, tolerancia } = angulos_meta;

        if (faseRef.current === 0) {
            if (Math.abs(angulo - angulo_reposo) <= tolerancia) {
                faseRef.current = 1;
                setStatus('¡Bien! Ahora contrae.');
            } else {
                setStatus(`Estira más. (${Math.round(angulo)}° / meta: ${angulo_reposo}°)`);
            }
        } else {
            if (Math.abs(angulo - angulo_contraccion) <= tolerancia) {
                faseRef.current = 0;
                setStatus('¡Excelente! Vuelve a estirar.');
                registrarRepeticion();
            } else {
                setStatus(`Contrae más. (${Math.round(angulo)}° / meta: ${angulo_contraccion}°)`);
            }
        }
    };

    const registrarRepeticion = () => {
        repRef.current -= 1;
        setRepFaltantes(repRef.current);
        if (repRef.current <= 0) {
            completadoRef.current = true;
            setCompletado(true);
            if (intervaloRef.current) clearInterval(intervaloRef.current);
            guardarProgresoYSalir();
        }
    };

    const guardarProgresoYSalir = async () => {
        try {
            setGuardando(true);
            guardandoRef.current = true;
            setStatus('Guardando progreso...');

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Sin usuario.');

            await supabase.from('sesion').insert({
                id_us: user.id, id_rut, id_eje,
                se_dur: Number(duracion) || null,
                se_completado: true,
                se_objetivo_logrado: 'Completado con IA Biométrica',
            });
            const { data: rutinaEjes } = await supabase
                .from('rutina_eje')
                .select('id_eje')
                .eq('id_rut', id_rut);

            const validIds = new Set(rutinaEjes?.map(r => r.id_eje) ?? []);
            const t = validIds.size || 1;

            // Intersectar con las sesiones completadas
            const { data: sesionesUnicas } = await supabase
                .from('sesion')
                .select('id_eje')
                .eq('id_us', user.id)
                .eq('id_rut', id_rut)
                .eq('se_completado', true);

            const n = new Set(
                sesionesUnicas?.map(s => s.id_eje).filter(id => validIds.has(id)) ?? []
            ).size;

            const porcentaje = Math.round((n / t) * 100);

            const { data: progreso } = await supabase
                .from('progreso_rutina').select('*')
                .eq('id_rut', id_rut).eq('id_us', user.id).maybeSingle();

            if (!progreso) {
                await supabase.from('progreso_rutina').insert({
                    id_rut, id_us: user.id,
                    prog_ejercicios_completados: n,
                    prog_ejercicios_total: t,
                    prog_porcentaje: porcentaje,
                    prog_completada: n >= t,
                });
            } else {
                await supabase.from('progreso_rutina').update({
                    prog_ejercicios_completados: n,
                    prog_ejercicios_total: t,
                    prog_porcentaje: porcentaje,
                    prog_completada: n >= t,
                }).eq('id_prog', progreso.id_prog);
            }

            setStatus('¡Guardado! Volviendo...');
            setTimeout(() => router.back(), 1500);
        } catch {
            Alert.alert('Error', 'No se pudo guardar el progreso.');
            setGuardando(false);
            guardandoRef.current = false;
        }
    };

    if (!permission) return <View style={styles.container} />;
    if (!permission.granted) return (
        <View style={[styles.container, styles.centrado]}>
            <Text style={styles.permText}>Se necesita permiso de cámara.</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="front"
            />

            <WebView
                ref={webviewRef}
                style={styles.webviewOculto}
                source={{ html: MEDIAPIPE_HTML }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                allowFileAccess={true}
                domStorageEnabled={true}
            />

            <View style={styles.top}>
                <Text style={styles.nombre}>{nombreEjercicio || 'Cargando...'}</Text>
                {!completado && !guardando && (
                    <View style={styles.counter}>
                        <Text style={styles.counterNum}>{repFaltantes}</Text>
                        <Text style={styles.counterLbl}>FALTAN</Text>
                    </View>
                )}
            </View>

            <View style={styles.overlay} pointerEvents="none">
                <View style={[styles.badge, completado && styles.badgeOk]}>
                    <Text style={styles.badgeTxt}>{status}</Text>
                </View>
            </View>

            {!modeloListo && (
                <View style={styles.cargando}>
                    <Text style={styles.cargandoTxt}>⏳ Cargando modelo de IA...</Text>
                    <Text style={styles.cargandoSub}>Requiere conexión a internet la primera vez</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centrado: { justifyContent: 'center', alignItems: 'center' },
    permText: { color: 'white', textAlign: 'center', padding: 20 },
    webviewOculto: { position: 'absolute', width: 1, height: 1, opacity: 0, top: -10 },
    overlay: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
    badge: { backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, borderWidth: 2, borderColor: '#00FF00' },
    badgeOk: { borderColor: '#00FF00', backgroundColor: 'rgba(0,50,0,0.8)' },
    badgeTxt: { color: '#00FF00', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
    top: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
    nombre: { color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10, overflow: 'hidden' },
    counter: { backgroundColor: 'rgba(155,27,110,0.9)', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 20, borderWidth: 3, borderColor: '#fce4f3' },
    counterNum: { color: 'white', fontSize: 60, fontWeight: 'bold' },
    counterLbl: { color: '#fce4f3', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
    cargando: { position: 'absolute', bottom: 130, left: 20, right: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 15, borderRadius: 12 },
    cargandoTxt: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    cargandoSub: { color: '#aaa', fontSize: 12, marginTop: 4 },
});
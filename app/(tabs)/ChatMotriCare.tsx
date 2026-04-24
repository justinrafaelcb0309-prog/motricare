import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GiftedChat, IMessage, Bubble, BubbleProps, Message, MessageProps
} from 'react-native-gifted-chat';
import { io, Socket } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/services/supabase';

const SOCKET_URL = 'http://192.168.0.10:3000';

export default function ChatMotriCare({ route }: any) {
  const [params, setParams] = useState(route?.params || {});
  const { pacienteId, pacienteNombre } = params;
  // pacienteId = f.id (id de la tabla fisioterapeutas, que es lo que usa id_fisio en conversaciones)

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState<boolean>(true);
  const [fisioterapeutas, setFisioterapeutas] = useState<any[]>([]);
  const insets=useSafeAreaInsets();

  // 1. Cargar solo fisios con cita pagada
  useEffect(() => {
    async function loadAuthorizedFisios() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) return;
        setUser(currentUser);

        const { data: citas } = await supabase
          .from('citas')
          .select(`fisioterapeuta_id, fisioterapeutas (id, user_id, nombre, apellido_paterno, especialidad)`)
          .eq('usuario_id', currentUser.id)
          .eq('estado', 'confirmada');

        if (citas) {
          const listaFisios = citas.map((c: any) => c.fisioterapeutas);
          const fisiosUnicos = listaFisios.filter(
            (v: any, i: number, a: any[]) => a.findIndex((t: any) => t.id === v.id) === i
          );
          setFisioterapeutas(fisiosUnicos);
        }
      } catch (e: any) { console.log("Error:", e.message); }
      finally { setCheckingPayment(false); }
    }
    loadAuthorizedFisios();
  }, []);

  // 2. Cargar historial — busca conversación por id_fisio (= f.id) e id_paciente
  // 2. Cargar o CREAR historial
  useEffect(() => {
    const verifyAndLoad = async () => {
      if (!pacienteId || !user) return;
      try {
        console.log("🔍 Buscando conv con id_fisio:", pacienteId, "id_paciente:", user.id);

        // 1. Intentar buscar la conversación existente
        let { data: conv, error: errorConv } = await supabase
          .from('conversaciones')
          .select('id')
          .eq('id_fisio', pacienteId)
          .eq('id_paciente', user.id)
          .maybeSingle();

        // 2. Si no existe, CREARLA
        if (!conv && !errorConv) {
          console.log("🆕 No existe conversación, creando una nueva...");
          const { data: newConv, error: createError } = await supabase
            .from('conversaciones')
            .insert([
              { id_fisio: pacienteId, id_paciente: user.id }
            ])
            .select()
            .single();

          if (createError) {
            console.error("❌ Error al crear conversación:", createError.message);
            return;
          }
          conv = newConv;
        }

        if (conv) {
          console.log("✅ ID de Conversación listo:", conv.id);
          setConversationId(conv.id);
          await cargarMensajes(conv.id, user);
        }

      } catch (e) {
        console.log("Error general en historial:", e);
      }
    };
    verifyAndLoad();
  }, [pacienteId, user]);

  const cargarMensajes = async (convId: string, currentUser: any) => {
    const { data: msgs, error } = await supabase
      .from('mensajes')
      .select('*')
      .eq('id_conv', convId)
      .order('msg_fecha', { ascending: false });

    console.log("📨 MENSAJES encontrados:", msgs?.length, "Error:", error?.message);

    if (msgs) {
      setMessages(msgs.map((m: any) => {
        const esMio = String(m.id_emisor) === String(currentUser.id);
        return {
          _id: String(m.id_msg),
          text: m.msg_texto || '',
          createdAt: m.msg_fecha ? new Date(m.msg_fecha) : new Date(),
          user: {
            _id: String(m.id_emisor),
            name: esMio ? 'Tú' : (pacienteNombre || 'Fisio'),
            avatar: !esMio
              ? `https://ui-avatars.com/api/?name=${pacienteNombre || 'F'}&background=3d0030&color=fff`
              : undefined,
          },
        };
      }));
    }
  };

  // 3. Socket.io
  useEffect(() => {
    if (!conversationId || !user) return;
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], forceNew: true });

    newSocket.on('connect', () => {
      newSocket.emit('join', conversationId);
      console.log("🔌 Socket conectado, sala:", conversationId);
    });

    newSocket.on('mensaje', (msg: any) => {
      const textoRecibido = msg.msg_texto || msg.texto || msg.text || msg.mensaje || "";
      const esMio = String(msg.id_emisor) === String(user?.id);

      console.log("📩 Socket msg recibido:", textoRecibido, "| id_conv msg:", msg.id_conv, "| mi convId:", conversationId);

      if (msg.id_conv === conversationId && !esMio) {
        const giftedMsg: IMessage = {
          _id: String(msg.id_msg || msg.id || Math.random()),
          text: textoRecibido,
          createdAt: msg.msg_fecha ? new Date(msg.msg_fecha) : new Date(),
          user: {
            _id: String(msg.id_emisor),
            name: pacienteNombre || 'Fisio',
            avatar: `https://ui-avatars.com/api/?name=${pacienteNombre || 'F'}&background=3d0030&color=fff`,
          },
        };
        setMessages((prev) => {
          const yaExiste = prev.some((m) => String(m._id) === String(giftedMsg._id));
          if (yaExiste) return prev;
          return GiftedChat.append(prev, [giftedMsg]);
        });
      }
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [conversationId, user?.id]);

  // 4. Supabase Realtime como respaldo
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`mensajes_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `id_conv=eq.${conversationId}`,
        },
        (payload) => {
          const nuevo = payload.new as any;
          if (String(nuevo.id_emisor) === String(user.id)) return;

          const giftedMsg: IMessage = {
            _id: String(nuevo.id_msg),
            text: nuevo.msg_texto || '',
            createdAt: nuevo.msg_fecha ? new Date(nuevo.msg_fecha) : new Date(),
            user: {
              _id: String(nuevo.id_emisor),
              name: pacienteNombre || 'Fisio',
              avatar: `https://ui-avatars.com/api/?name=${pacienteNombre || 'F'}&background=3d0030&color=fff`,
            },
          };

          setMessages((prev) => {
            const yaExiste = prev.some((m) => String(m._id) === String(nuevo.id_msg));
            if (yaExiste) return prev;
            return GiftedChat.append(prev, [giftedMsg]);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id]);

  // Envío
  const onSend = useCallback(async (msgsArr: IMessage[] = []) => {
    if (!user || !conversationId || msgsArr.length === 0) return;
    const msg = msgsArr[0];
    const messageId = String(msg._id);

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('url_foto')
      .eq('id', user.id)
      .single();

    let avatarFinal = "";
    if (perfil?.url_foto) {
      avatarFinal = perfil.url_foto.startsWith('http')
        ? perfil.url_foto
        : supabase.storage.from('perfil_pacientes').getPublicUrl(perfil.url_foto).data.publicUrl;
    } else {
      avatarFinal = `https://ui-avatars.com/api/?name=Justin+Rafael&background=9b1b6e&color=fff`;
    }

    const payload = {
      id_msg: messageId,
      id_conv: conversationId,
      id_emisor: user.id,
      msg_texto: msg.text,
      texto: msg.text,
      text: msg.text,
      mensaje: msg.text,
      msg_fecha: new Date().toISOString(),
      usuario: {
        id: user.id,
        _id: user.id,
        nombre: 'Justin Rafael',
        avatar: avatarFinal,
        image: avatarFinal
      }
    };

    if (socket?.connected) { socket.emit('mensaje', payload); }

    await supabase.from('mensajes').insert({
      id_msg: messageId,
      id_conv: conversationId,
      id_emisor: user.id,
      msg_texto: msg.text,
      msg_fecha: payload.msg_fecha,
      msg_leido: false
    });

    setMessages((prev) => GiftedChat.append(prev, msgsArr));
  }, [socket, user, conversationId]);

  const renderMessage = (props: MessageProps<IMessage>) => {
    const { key, ...rest } = props as any;
    return <Message {...rest} key={String(props.currentMessage?._id || Math.random())} />;
  };

  const renderBubble = (props: BubbleProps<IMessage>) => {
    const { key, ...rest } = props as any;
    return (
      <Bubble
        {...rest}
        key={String(props.currentMessage?._id)}
        wrapperStyle={{ right: { backgroundColor: '#9b1b6e' } }}
      />
    );
  };

  if (checkingPayment) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#9b1b6e" />
    </View>
  );

  if (!pacienteId) {
    return (

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerName}>Mensajes MotriCare</Text>
        </View>
        <ScrollView style={{ padding: 15 }}>
          {fisioterapeutas.length === 0 && (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
              No tienes citas confirmadas aún.
            </Text>
          )}
          {fisioterapeutas.map((f) => (
            <TouchableOpacity
              key={f.id}
              // ✅ Ahora usamos f.id (id de fisioterapeutas) que coincide con id_fisio en conversaciones
              onPress={() => setParams({ pacienteId: f.id, pacienteNombre: f.nombre })}
              style={styles.fisioOption}
            >
              <Image
                source={{ uri: `https://ui-avatars.com/api/?name=${f.nombre}&background=9b1b6e&color=fff` }}
                style={styles.miniAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.fisioNameOption}>Dr. {f.nombre} {f.apellido_paterno}</Text>
                <Text style={styles.especialidadMini}>{f.especialidad || 'Fisio'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9b1b6e" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setParams({})} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerName}>{pacienteNombre}</Text>
      </View>
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{ _id: String(user?.id) }}
          renderMessage={renderMessage}
          renderBubble={renderBubble}
          placeholder="Escribe un mensaje..."
          bottomOffset={insets.bottom}
          keyboardShouldPersistTaps="never"
          listViewProps={{ keyExtractor: (item: IMessage) => String(item._id) }}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  header: {
    backgroundColor: '#9b1b6e',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  fisioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fce4f3',
    borderRadius: 15,
    marginBottom: 10
  },
  miniAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  fisioNameOption: { fontWeight: 'bold', fontSize: 16 },
  especialidadMini: { color: '#9b1b6e', fontSize: 12 }
});
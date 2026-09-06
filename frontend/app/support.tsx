import React, { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CaretLeft, PaperPlaneRight, Headset } from "phosphor-react-native";

import { makeStyles, fonts, useTheme } from "@/src/theme";
import { Input } from "@/src/components/ui";
import { api } from "@/src/api";

type Msg = { role: "user" | "assistant"; content: string };

export default function Support() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your TK SafetyGuard helper. Ask me how to run an assessment, apply a LOTO lock, sign in at the gate, export a PDF — anything about using the app." },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setText("");
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.post("/support/chat", { message: q, history: messages });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the help service. Please try again." }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.back} testID="support-back">
          <CaretLeft size={22} color={colors.onSurface} weight="bold" />
        </Pressable>
        <View style={s.titleWrap}>
          <Headset size={18} color={colors.onSurface} weight="fill" />
          <Text style={s.headerLabel}>HELP & SUPPORT</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === "user" ? s.user : s.assistant]} testID={`msg-${i}`}>
            <Text style={[s.bubbleText, m.role === "user" ? s.userText : s.assistantText]}>{m.content}</Text>
          </View>
        ))}
        {busy ? <View style={[s.bubble, s.assistant]}><ActivityIndicator color={colors.onSurface} /></View> : null}
      </ScrollView>

      <KeyboardAwareScrollView
        contentContainerStyle={[s.inputBar, { paddingBottom: insets.bottom + 10 }]}
        bottomOffset={10}
        scrollEnabled={false}
      >
        <Input
          value={text}
          onChangeText={setText}
          placeholder="Ask a question..."
          style={s.input}
          testID="support-input"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={s.sendBtn} onPress={send} disabled={busy || !text.trim()} testID="support-send">
          <PaperPlaneRight size={22} color={colors.onBrandPrimary} weight="fill" />
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surface },
  back: { width: 22 },
  titleWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerLabel: { fontFamily: fonts.monoBold, fontSize: 13, color: c.onSurface, letterSpacing: 1 },
  scroll: { padding: 16, gap: 12 },
  bubble: { maxWidth: "86%", padding: 12, borderWidth: 2, borderColor: c.borderStrong },
  user: { alignSelf: "flex-end", backgroundColor: c.brandPrimary },
  assistant: { alignSelf: "flex-start", backgroundColor: c.surfaceSecondary },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  userText: { color: c.onBrandPrimary },
  assistantText: { color: c.onSurfaceSecondary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
  input: { flex: 1 },
  sendBtn: { width: 52, height: 52, backgroundColor: c.brandPrimary, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
}));

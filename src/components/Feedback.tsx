import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';
import { Button, Field } from './Controls';
import { Glass } from './Glass';
import { T } from './Text';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
}

interface Feedback {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  toast: (message: string, action?: { label: string; onPress: () => void }) => void;
  /** Shows an error message from any thrown value. */
  fail: (e: unknown) => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}

type DialogState = { kind: 'confirm'; options: ConfirmOptions } | { kind: 'prompt'; options: PromptOptions; value: string } | null;

/** Glass dialogs (confirm, prompt) and a glass toast with an optional action. */
export function FeedbackProvider({ children, describeError }: PropsWithChildren<{ describeError: (e: unknown) => string }>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<DialogState>(null);
  const resolver = useRef<((v: unknown) => void) | null>(null);
  const [snack, setSnack] = useState<{ message: string; action?: { label: string; onPress: () => void }; key: number } | null>(null);

  useEffect(() => {
    if (!snack) return;
    const timer = setTimeout(() => setSnack(null), snack.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [snack]);

  const finish = (value: unknown) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  };

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setDialog({ kind: 'confirm', options });
      }),
    [],
  );
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        resolver.current = resolve as (v: unknown) => void;
        setDialog({ kind: 'prompt', options, value: options.initial ?? '' });
      }),
    [],
  );
  const toast = useCallback((message: string, action?: { label: string; onPress: () => void }) => setSnack({ message, action, key: Date.now() }), []);
  const fail = useCallback((e: unknown) => toast(describeError(e)), [toast, describeError]);

  const cancelValue = dialog?.kind === 'confirm' ? false : null;

  return (
    <FeedbackContext.Provider value={{ confirm, prompt, toast, fail }}>
      {children}

      <Modal visible={!!dialog} transparent statusBarTranslucent animationType="none" onRequestClose={() => finish(cancelValue)}>
        {dialog && (
          <View style={styles.dialogRoot}>
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]}>
              <Pressable style={{ flex: 1 }} onPress={() => finish(cancelValue)} accessibilityLabel="Dismiss" />
            </Animated.View>
            <Animated.View entering={ZoomIn.springify().damping(16).stiffness(260)} style={styles.dialogWrap}>
              <Glass variant="pane" strong blur radius={30} contentStyle={styles.dialog}>
                <T variant="heading">{dialog.options.title}</T>
                {dialog.kind === 'confirm' && dialog.options.message && (
                  <T variant="body" tone="dim">
                    {dialog.options.message}
                  </T>
                )}
                {dialog.kind === 'prompt' && (
                  <Field
                    label={dialog.options.label}
                    value={dialog.value}
                    autoFocus
                    onChangeText={(value) => setDialog({ ...dialog, value })}
                    onSubmitEditing={() => dialog.value.trim() && finish(dialog.value.trim())}
                  />
                )}
                <View style={styles.dialogActions}>
                  <Button title="Cancel" variant="ghost" size="sm" onPress={() => finish(cancelValue)} />
                  {dialog.kind === 'confirm' ? (
                    <Button
                      title={dialog.options.confirmLabel ?? 'OK'}
                      variant={dialog.options.destructive ? 'danger' : 'primary'}
                      size="sm"
                      onPress={() => finish(true)}
                    />
                  ) : (
                    <Button title={dialog.options.confirmLabel ?? 'Save'} size="sm" disabled={!dialog.value.trim()} onPress={() => finish(dialog.value.trim())} />
                  )}
                </View>
              </Glass>
            </Animated.View>
          </View>
        )}
      </Modal>

      {snack && (
        <Animated.View key={snack.key} entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown.duration(180)} style={[styles.toastWrap, { bottom: insets.bottom + 96 }]} pointerEvents="box-none">
          <Glass variant="pill" blur strong contentStyle={styles.toast}>
            <T variant="label" style={{ flexShrink: 1 }}>
              {snack.message}
            </T>
            {snack.action && (
              <Pressable
                onPress={() => {
                  snack.action?.onPress();
                  setSnack(null);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={snack.action.label}
              >
                <T variant="label" tone="accent" style={{ fontWeight: '700' }}>
                  {snack.action.label}
                </T>
              </Pressable>
            )}
          </Glass>
        </Animated.View>
      )}
    </FeedbackContext.Provider>
  );
}

const styles = StyleSheet.create({
  dialogRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  dialogWrap: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  dialog: { padding: space.xl, gap: space.md },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl, minHeight: 52 },
});

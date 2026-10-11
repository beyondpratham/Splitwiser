import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { Button, Dialog, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

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

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions }
  | { kind: 'prompt'; options: PromptOptions; value: string }
  | null;

export function FeedbackProvider({ children, describeError }: PropsWithChildren<{ describeError: (e: unknown) => string }>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<DialogState>(null);
  const resolver = useRef<((v: unknown) => void) | null>(null);
  const [snack, setSnack] = useState<{ message: string; action?: { label: string; onPress: () => void }; key: number } | null>(null);

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
  const toast = useCallback((message: string, action?: { label: string; onPress: () => void }) => {
    setSnack({ message, action, key: Date.now() });
  }, []);
  const fail = useCallback((e: unknown) => toast(describeError(e)), [toast, describeError]);

  return (
    <FeedbackContext.Provider value={{ confirm, prompt, toast, fail }}>
      {children}
      <Portal>
        <Dialog visible={dialog?.kind === 'confirm'} onDismiss={() => finish(false)}>
          {dialog?.kind === 'confirm' && (
            <>
              <Dialog.Title>{dialog.options.title}</Dialog.Title>
              {dialog.options.message && (
                <Dialog.Content>
                  <Text variant="bodyMedium">{dialog.options.message}</Text>
                </Dialog.Content>
              )}
              <Dialog.Actions>
                <Button onPress={() => finish(false)}>Cancel</Button>
                <Button onPress={() => finish(true)} textColor={dialog.options.destructive ? t.colors.error : undefined}>
                  {dialog.options.confirmLabel ?? 'OK'}
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
        <Dialog visible={dialog?.kind === 'prompt'} onDismiss={() => finish(null)}>
          {dialog?.kind === 'prompt' && (
            <>
              <Dialog.Title>{dialog.options.title}</Dialog.Title>
              <Dialog.Content>
                <TextInput
                  mode="outlined"
                  label={dialog.options.label}
                  value={dialog.value}
                  autoFocus
                  onChangeText={(value) => setDialog({ ...dialog, value })}
                  onSubmitEditing={() => dialog.value.trim() && finish(dialog.value.trim())}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => finish(null)}>Cancel</Button>
                <Button onPress={() => finish(dialog.value.trim())} disabled={!dialog.value.trim()}>
                  {dialog.options.confirmLabel ?? 'Save'}
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
        <Snackbar
          key={snack?.key}
          visible={!!snack}
          onDismiss={() => setSnack(null)}
          duration={snack?.action ? 6000 : 3500}
          action={snack?.action}
          wrapperStyle={{ bottom: insets.bottom + 72 }}
        >
          {snack?.message}
        </Snackbar>
      </Portal>
    </FeedbackContext.Provider>
  );
}

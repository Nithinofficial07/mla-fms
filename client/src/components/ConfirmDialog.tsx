import { useState, useCallback, type ReactNode } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

/** Hook returning a `confirm()` that resolves true/false. */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = (
    <Dialog open={!!state} onClose={() => close(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{state?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{state?.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(false)}>Cancel</Button>
        <Button
          variant="contained"
          color={state?.destructive ? 'error' : 'primary'}
          onClick={() => close(true)}
        >
          {state?.confirmLabel ?? 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { confirm, dialog };
}

import { Fade, LinearProgress } from '@mui/material';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

/** Slim YouTube/GitHub-style progress bar under the AppBar, driven by global react-query activity. */
export function TopProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  return (
    <Fade in={active} timeout={{ enter: 150, exit: 400 }} unmountOnExit>
      <LinearProgress
        color="secondary"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: (t) => t.zIndex.drawer + 2,
          bgcolor: 'transparent',
        }}
      />
    </Fade>
  );
}

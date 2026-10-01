import { useTranslation } from 'react-i18next';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { setLanguage, type Language } from '@/i18n';

/** EN / ಕನ್ನಡ switch - mirrors the dark-mode toggle's per-browser persistence. */
export function LanguageToggle({ light = false }: { light?: boolean }) {
  const { i18n, t } = useTranslation();
  const current: Language = i18n.language === 'kn' ? 'kn' : 'en';

  return (
    <Tooltip title={t('common.language')}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={current}
        onChange={(_e, next: Language | null) => next && setLanguage(next)}
        sx={{
          bgcolor: light ? 'rgba(255,255,255,0.12)' : 'background.paper',
          '& .MuiToggleButton-root': {
            color: light ? 'rgba(255,255,255,0.85)' : 'text.secondary',
            borderColor: light ? 'rgba(255,255,255,0.3)' : undefined,
            px: 1.25,
            py: 0.25,
            fontSize: '0.75rem',
            fontWeight: 700,
            '&.Mui-selected': {
              bgcolor: light ? 'rgba(255,255,255,0.22)' : undefined,
              color: light ? '#fff' : 'primary.main',
            },
          },
        }}
      >
        <ToggleButton value="en">EN</ToggleButton>
        <ToggleButton value="kn">ಕನ್ನಡ</ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}

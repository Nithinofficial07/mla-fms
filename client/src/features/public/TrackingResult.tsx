import { useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { StatusChip } from '@/components/chips';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import type { TrackResult } from './trackTypes';

const ICONS: Record<string, string> = {
  FILE_CREATED: 'NoteAdd',
  REQUEST_SUBMIT: 'Send',
  STATUS_CHANGE: 'SwapHoriz',
  REQUEST_ASSIGN: 'AssignmentInd',
  REQUEST_FORWARD: 'Forward',
};

const STAGES = [
  { key: 'REGISTERED', en: 'Registered & Acknowledged', kn: 'ನೋಂದಾಯಿಸಲಾಗಿದೆ', icon: 'NoteAdd' },
  { key: 'SCRUTINY', en: 'Office Scrutiny', kn: 'ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ', icon: 'HourglassEmpty' },
  { key: 'DEPT', en: 'Forwarded to Dept', kn: 'ಇಲಾಖೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ', icon: 'AssignmentInd' },
  { key: 'ACTION', en: 'Field Action / In Progress', kn: 'ಪ್ರಗತಿಯಲ್ಲಿದೆ', icon: 'Autorenew' },
  { key: 'RESOLVED', en: 'Resolved / Final Order', kn: 'ಪರಿಹರಿಸಲಾಗಿದೆ', icon: 'CheckCircle' },
];

function getStageIndex(code: string): number {
  switch (code) {
    case 'SUBMITTED':
    case 'DRAFT':
      return 0;
    case 'UNDER_REVIEW':
    case 'AWAITING_INFO':
      return 1;
    case 'ASSIGNED':
      return 2;
    case 'IN_PROGRESS':
    case 'FORWARDED':
    case 'DEPT_RESPONSE':
      return 3;
    case 'COMPLETED':
    case 'APPROVED':
    case 'CLOSED':
      return 4;
    default:
      return 0;
  }
}

export function TrackingResult({ result, onReset }: { result: TrackResult; onReset?: () => void }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [lang, setLang] = useState<'en' | 'kn'>('en');

  const currentStage = getStageIndex(result.statusCode);
  const isResolved = ['COMPLETED', 'APPROVED', 'CLOSED'].includes(result.statusCode);
  const isRejected = result.statusCode === 'REJECTED';

  const shareText = `MLA Office Petition Status:
File ID: ${result.fileId}
Subject: ${result.subject}
Status: ${result.statusName}
Department: ${result.department ?? 'In Office'}
Track online: ${window.location.href}`;

  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <Box>
      {/* Official Watermark / Header Card */}
      <Card
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: isResolved ? 'rgba(16, 185, 129, 0.3)' : 'divider',
          background: isDark
            ? 'linear-gradient(145deg, #111827 0%, #0B132B 100%)'
            : 'linear-gradient(145deg, #ffffff 0%, #F8FAFC 100%)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 12px rgba(10,37,64,0.3)',
              }}
            >
              <Icon name="AccountBalance" fontSize="medium" />
            </Box>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 1, fontWeight: 700, color: 'text.secondary', display: 'block', lineHeight: 1 }}>
                OFFICIAL CITIZEN TRACKING RECEIPT
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', mt: 0.5 }}>
                {result.fileId}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {/* Language Toggle */}
            <Chip
              size="small"
              clickable
              onClick={() => setLang((l) => (l === 'en' ? 'kn' : 'en'))}
              label={lang === 'en' ? 'ಕನ್ನಡ (KN)' : 'English (EN)'}
              sx={{ fontWeight: 700, fontSize: '0.75rem' }}
            />
            <StatusChip code={result.statusCode} label={result.statusName} />
          </Stack>
        </Stack>

        <Typography variant="body1" fontWeight={600} sx={{ mb: 2, color: 'text.primary' }}>
          {result.subject}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {/* Milestone Tracker */}
        {!isRejected ? (
          <Box sx={{ mb: 2.5, px: 0.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5, display: 'block' }}>
              {lang === 'en' ? 'Petition Milestone Progress' : 'ಅರ್ಜಿಯ ಪ್ರಗತಿ ಹಂತಗಳು'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', pb: 1 }}>
              {STAGES.map((s, idx) => {
                const isPassed = currentStage > idx;
                const isCurrent = currentStage === idx;
                const color = isPassed ? '#059669' : isCurrent ? '#2563EB' : 'text.disabled';

                return (
                  <Stack key={s.key} direction="row" alignItems="center" sx={{ flexGrow: 1, minWidth: 100 }}>
                    <Stack spacing={0.5} alignItems="center" sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: isPassed ? 'rgba(16, 185, 129, 0.15)' : isCurrent ? 'rgba(37, 99, 235, 0.15)' : 'action.hover',
                          color,
                          display: 'grid',
                          placeItems: 'center',
                          border: '2px solid',
                          borderColor: isPassed ? '#059669' : isCurrent ? '#2563EB' : 'divider',
                          animation: isCurrent ? 'pulseGlow 2s infinite ease-in-out' : 'none',
                        }}
                      >
                        <Icon name={isPassed ? 'CheckCircle' : s.icon} sx={{ fontSize: '1rem' }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.675rem', fontWeight: isCurrent ? 700 : 500, maxWidth: 90, lineHeight: 1.2 }}>
                        {lang === 'en' ? s.en : s.kn}
                      </Typography>
                    </Stack>
                    {idx < STAGES.length - 1 && (
                      <Box
                        sx={{
                          flexGrow: 1,
                          height: 2,
                          mx: 1,
                          bgcolor: isPassed ? '#059669' : 'divider',
                          minWidth: 20,
                        }}
                      />
                    )}
                  </Stack>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Alert severity="error" sx={{ mb: 2 }}>
            This application has been closed or marked as ineligible.
          </Alert>
        )}

        {/* Metadata Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{lang === 'en' ? 'Line Department' : 'ಸಂಬಂಧಿಸಿದ ಇಲಾಖೆ'}</Typography>
            <Typography variant="body2" fontWeight={700}>{result.department ?? (lang === 'en' ? 'Under Allocation' : 'ನಿಯೋಜಿಸಲಾಗುತ್ತಿದೆ')}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{lang === 'en' ? 'Submitted Date' : 'ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ'}</Typography>
            <Typography variant="body2" fontWeight={700}>{dayjs(result.submittedAt).format('DD MMM YYYY')}</Typography>
          </Box>
          {result.dueDate && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{lang === 'en' ? 'Expected Target' : 'ನಿರೀಕ್ಷಿತ ದಿನಾಂಕ'}</Typography>
              <Typography variant="body2" fontWeight={700}>{dayjs(result.dueDate).format('DD MMM YYYY')}</Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{lang === 'en' ? 'Last Updated' : 'ಕೊನೆಯ ನವೀಕರಣ'}</Typography>
            <Typography variant="body2" fontWeight={700}>{dayjs(result.updatedAt).format('DD MMM YYYY')}</Typography>
          </Box>
        </Box>

        {/* Citizen Quick Action Bar */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
          <Button
            component="a"
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            variant="contained"
            color="success"
            fullWidth
            startIcon={<Icon name="Send" />}
            sx={{ fontWeight: 700 }}
          >
            {lang === 'en' ? 'Share to WhatsApp' : 'ವಾಟ್ಸಾಪ್‌ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಿ'}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<Icon name="Print" />}
            onClick={() => window.print()}
          >
            {lang === 'en' ? 'Print Slip' : 'ಮುದ್ರಿಸಿ'}
          </Button>
        </Stack>
      </Card>

      {/* Official Audit Timeline */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, px: 0.5 }}>
        {lang === 'en' ? 'Official Case Timeline' : 'ಪ್ರಕ್ರಿಯೆಯ ಇತಿಹಾಸ'}
      </Typography>

      {result.timeline.length === 0 ? (
        <EmptyState icon="Timeline" title="No updates yet" />
      ) : (
        <Box sx={{ pl: 1 }}>
          {result.timeline.map((e, i) => (
            <Stack key={i} direction="row" spacing={2} sx={{ position: 'relative', pb: 2.5 }}>
              {i < result.timeline.length - 1 && (
                <Box sx={{ position: 'absolute', left: 15, top: 30, bottom: 0, width: 2, bgcolor: 'divider' }} />
              )}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon name={ICONS[e.action] ?? 'FiberManualRecord'} fontSize="small" />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700}>{e.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(e.at).format('DD MMM YYYY, hh:mm A')}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      )}

      {onReset && (
        <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Chip
            size="small"
            variant="outlined"
            icon={<Icon name="ArrowBack" />}
            label={lang === 'en' ? 'Track another request' : 'ಮತ್ತೊಂದು ಅರ್ಜಿಯನ್ನು ಪರಿಶೀಲಿಸಿ'}
            onClick={onReset}
            clickable
          />
        </Box>
      )}
    </Box>
  );
}

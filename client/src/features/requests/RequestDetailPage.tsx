import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { RequestDetailContent } from './RequestDetailContent';

export function RequestDetailPage() {
  const { id = '' } = useParams();

  return (
    <Box>
      <PageHeader
        title="Request Detail"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Requests', to: '/requests' }, { label: 'Detail' }]}
      />
      <RequestDetailContent id={id} />
    </Box>
  );
}

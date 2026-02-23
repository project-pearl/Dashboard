import { Metadata } from 'next';
import MS4DataUpload from '@/components/ms4/uploads/MS4DataUpload';

export const metadata: Metadata = {
  title: 'Data Upload | MS4 | PIN',
  description: 'Upload lab results, field data, and compliance documents',
};

export default function MS4UploadsPage() {
  return <MS4DataUpload />;
}

// app/applications/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/layout/Header';
import { ApplicationCreateFlow } from '@/app/components/applications/ApplicationCreateFlow';

export default function NewApplicationPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    router.back();
  }

  function handleSaved(id: string) {
    router.replace(`/applications/${id}`);
  }

  return (
    <>
      <Header />
      <ApplicationCreateFlow
        open={open}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </>
  );
}
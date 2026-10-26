'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function DocumentDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  useEffect(() => {
    if (id) {
      router.replace(`/documentos/editor?id=${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  return (
    <div className="p-8 text-center text-sm text-gray-400">
      Cargando documento...
    </div>
  );
}

export default function DocumentDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Cargando...</div>}>
      <DocumentDetailRedirect {...props} />
    </Suspense>
  );
}

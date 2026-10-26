'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function DocumentPrintRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  useEffect(() => {
    if (id) {
      router.replace(`/documentos/imprimir?id=${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  return (
    <div className="p-8 text-center text-sm text-gray-400">
      Cargando vista de impresión oficial...
    </div>
  );
}

export default function DocumentPrintParamPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Cargando...</div>}>
      <DocumentPrintRedirect {...props} />
    </Suspense>
  );
}

import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { PortfolioPosition } from '../../domain/types';
import type {
  B3ImportMode,
  B3ParsedPosition,
} from '../../domain/import/b3Import';
import { buildB3ImportPreview } from '../../domain/import/b3Import';
import { parseB3ImportFile } from '../../engine/import/b3ImportService';
import { parseB3Pdf } from '../../infra/b3pdf/parseB3Pdf';

const B3ImportModal = lazy(async () => {
  const module = await import('./B3ImportModal');
  return { default: module.B3ImportModal };
});

interface B3ImportButtonProps {
  currentPositions: PortfolioPosition[];
  onConfirmImport: (
    parsed: B3ParsedPosition[],
    mode: B3ImportMode
  ) => void;
}

const INITIAL_MODE: B3ImportMode = 'MERGE';

export function B3ImportButton({
  currentPositions,
  onConfirmImport,
}: B3ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [parsedPositions, setParsedPositions] = useState<B3ParsedPosition[]>([]);
  const [selectedMode, setSelectedMode] = useState<B3ImportMode>(INITIAL_MODE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const hasParsedPositions = parsedPositions.length > 0;

  const preview = useMemo(() => {
    if (!hasParsedPositions) return null;

    try {
      return buildB3ImportPreview(
        currentPositions,
        parsedPositions,
        selectedMode
      );
    } catch (error) {
      console.error('Failed to build preview', error);
      return null;
    }
  }, [currentPositions, parsedPositions, selectedMode, hasParsedPositions]);

  const resetFlow = useCallback(() => {
    setParsedPositions([]);
    setSelectedMode(INITIAL_MODE);
    setErrorMessage('');

    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const openFilePicker = useCallback(() => {
    if (isProcessing) return;
    setErrorMessage('');
    inputRef.current?.click();
  }, [isProcessing]);

  const handleFileSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;
      event.currentTarget.value = '';

      if (!file) return;

      setIsProcessing(true);
      setErrorMessage('');
      setParsedPositions([]);

      try {
        let positions: B3ParsedPosition[] = [];

        // 🔥 DETECÇÃO AUTOMÁTICA DE TIPO
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          positions = await parseB3Pdf(file);
        } else {
          const content = await file.text();
          const result = parseB3ImportFile(content);
          positions = result.positions;
        }

        if (!positions || positions.length === 0) {
          setErrorMessage(
            'Nenhum ativo elegível foi encontrado no arquivo da B3.'
          );
          return;
        }

        setParsedPositions(positions);
      } catch (error) {
        console.error('Import error:', error);
        setErrorMessage(
          'Erro ao processar arquivo da B3. Verifique o formato.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (!hasParsedPositions) return;

    onConfirmImport(parsedPositions, selectedMode);
    resetFlow();
  }, [hasParsedPositions, parsedPositions, selectedMode, onConfirmImport, resetFlow]);

  const handleCancel = useCallback(() => {
    resetFlow();
  }, [resetFlow]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.pdf,application/pdf,text/csv,text/plain"
        hidden
        onChange={handleFileSelection}
      />

      <button
        type="button"
        onClick={openFilePicker}
        disabled={isProcessing}
      >
        {isProcessing ? 'Importando...' : 'Importar B3'}
      </button>

      {errorMessage && (
        <p className="negative">{errorMessage}</p>
      )}

      {preview && (
        <Suspense fallback={null}>
          <B3ImportModal
            preview={preview}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </Suspense>
      )}
    </>
  );
}
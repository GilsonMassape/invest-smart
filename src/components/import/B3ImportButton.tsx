import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import type { PortfolioPosition } from '../../domain/types';
import type {
  B3ImportMode,
  B3ParsedPosition,
} from '../../domain/import/b3Import';
import { buildB3ImportPreview } from '../../domain/import/b3Import';
import { parseB3ImportFile } from '../../engine/import/b3ImportService';

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

const readFileAsText = async (file: File): Promise<string> => file.text();

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
    if (!hasParsedPositions) {
      return null;
    }

    try {
      return buildB3ImportPreview(
        currentPositions,
        parsedPositions,
        selectedMode
      );
    } catch (error) {
      console.error('Failed to build B3 import preview.', error);
      return null;
    }
  }, [currentPositions, hasParsedPositions, parsedPositions, selectedMode]);

  const resetFlow = useCallback(() => {
    setParsedPositions([]);
    setSelectedMode(INITIAL_MODE);
    setErrorMessage('');

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const openFilePicker = useCallback(() => {
    if (isProcessing) {
      return;
    }

    setErrorMessage('');
    inputRef.current?.click();
  }, [isProcessing]);

  const handleFileSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0] ?? null;

      input.value = '';

      if (!file) {
        return;
      }

      setIsProcessing(true);
      setErrorMessage('');
      setParsedPositions([]);

      try {
        const content = await readFileAsText(file);
        const result = parseB3ImportFile(content);

        if (!Array.isArray(result.positions) || result.positions.length === 0) {
          setErrorMessage(
            'Nenhum ativo elegível foi encontrado no arquivo da B3.'
          );
          return;
        }

        setParsedPositions(result.positions);
      } catch (error) {
        console.error('Failed to parse B3 file.', error);
        setErrorMessage(
          'Não foi possível processar o arquivo da B3. Verifique o arquivo e tente novamente.'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (!hasParsedPositions) {
      return;
    }

    onConfirmImport(parsedPositions, selectedMode);
    resetFlow();
  }, [hasParsedPositions, onConfirmImport, parsedPositions, resetFlow, selectedMode]);

  const handleCancel = useCallback(() => {
    resetFlow();
  }, [resetFlow]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        hidden
        onChange={handleFileSelection}
      />

      <button
        type="button"
        onClick={openFilePicker}
        disabled={isProcessing}
        aria-busy={isProcessing}
      >
        {isProcessing ? 'Importando...' : 'Importar B3'}
      </button>

      {errorMessage !== '' && (
        <p className="negative" role="alert">
          {errorMessage}
        </p>
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
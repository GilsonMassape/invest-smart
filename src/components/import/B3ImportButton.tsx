import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import type { PortfolioPosition } from '../../domain/types'
import type {
  B3ImportMode,
  B3ParsedPosition,
} from '../../domain/import/b3Import'
import { buildB3ImportPreview } from '../../domain/import/b3Import'
import { parseB3ImportFile } from '../../engine/import/b3ImportService'

const B3ImportModal = lazy(async () => {
  const module = await import('./B3ImportModal')
  return { default: module.B3ImportModal }
})

type ParseB3Pdf = (file: File) => Promise<B3ParsedPosition[]>

async function loadB3PdfParser(): Promise<ParseB3Pdf> {
  const module = await import('../../infra/B3/parseB3Pdf')
  return module.parseB3Pdf
}

interface B3ImportButtonProps {
  currentPositions: PortfolioPosition[]
  onConfirmImport: (
    parsed: B3ParsedPosition[],
    mode: B3ImportMode
  ) => void
}

const INITIAL_MODE: B3ImportMode = 'MERGE'
const EMPTY_ERROR_MESSAGE = ''

function isPdfFile(file: File): boolean {
  const normalizedName = file.name.trim().toLowerCase()
  return file.type === 'application/pdf' || normalizedName.endsWith('.pdf')
}

function normalizeImportedPositions(
  positions: B3ParsedPosition[] | null | undefined
): B3ParsedPosition[] {
  if (!Array.isArray(positions)) {
    return []
  }

  return positions
    .filter((position) => {
      if (!position || typeof position !== 'object') {
        return false
      }

      const hasValidTicker =
        typeof position.ticker === 'string' &&
        position.ticker.trim().length > 0

      const hasValidQuantity =
        typeof position.quantity === 'number' &&
        Number.isFinite(position.quantity) &&
        position.quantity > 0

      const hasValidAvgPrice =
        typeof position.avgPrice === 'number' &&
        Number.isFinite(position.avgPrice) &&
        position.avgPrice >= 0

      return hasValidTicker && hasValidQuantity && hasValidAvgPrice
    })
    .map((position) => ({
      ticker: position.ticker.trim().toUpperCase(),
      quantity: Number(position.quantity.toFixed(8)),
      avgPrice: Number(position.avgPrice.toFixed(8)),
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

export function B3ImportButton({
  currentPositions,
  onConfirmImport,
}: B3ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isMountedRef = useRef(true)

  const [parsedPositions, setParsedPositions] = useState<B3ParsedPosition[]>([])
  const [selectedMode, setSelectedMode] = useState<B3ImportMode>(INITIAL_MODE)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState(EMPTY_ERROR_MESSAGE)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const hasParsedPositions = parsedPositions.length > 0

  const preview = useMemo(() => {
    if (!hasParsedPositions) {
      return null
    }

    try {
      return buildB3ImportPreview(
        currentPositions,
        parsedPositions,
        selectedMode
      )
    } catch (error) {
      console.error('Failed to build B3 import preview:', error)
      return null
    }
  }, [currentPositions, parsedPositions, selectedMode, hasParsedPositions])

  const resetInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [])

  const resetFlow = useCallback(() => {
    setParsedPositions([])
    setSelectedMode(INITIAL_MODE)
    setErrorMessage(EMPTY_ERROR_MESSAGE)
    setIsProcessing(false)
    resetInput()
  }, [resetInput])

  const openFilePicker = useCallback(() => {
    if (isProcessing || hasParsedPositions) {
      return
    }

    setErrorMessage(EMPTY_ERROR_MESSAGE)
    inputRef.current?.click()
  }, [isProcessing, hasParsedPositions])

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null
      event.currentTarget.value = ''

      if (!file) {
        return
      }

      setIsProcessing(true)
      setErrorMessage(EMPTY_ERROR_MESSAGE)
      setParsedPositions([])

      try {
        let positions: B3ParsedPosition[] = []

        if (isPdfFile(file)) {
          const parseB3Pdf = await loadB3PdfParser()
          positions = await parseB3Pdf(file)
        } else {
          const content = await file.text()
          const result = parseB3ImportFile(content)
          positions = result.positions
        }

        const normalizedPositions = normalizeImportedPositions(positions)

        if (!isMountedRef.current) {
          return
        }

        if (normalizedPositions.length === 0) {
          setErrorMessage(
            'Nenhum ativo elegível foi encontrado no arquivo da B3.'
          )
          return
        }

        setParsedPositions(normalizedPositions)
      } catch (error) {
        console.error('B3 import error:', error)

        if (!isMountedRef.current) {
          return
        }

        setErrorMessage(
          'Erro ao processar arquivo da B3. Verifique o formato e tente novamente.'
        )
      } finally {
        if (isMountedRef.current) {
          setIsProcessing(false)
        }
      }
    },
    []
  )

  const handleConfirm = useCallback(() => {
    if (!hasParsedPositions) {
      return
    }

    onConfirmImport(parsedPositions, selectedMode)
    resetFlow()
  }, [
    hasParsedPositions,
    onConfirmImport,
    parsedPositions,
    resetFlow,
    selectedMode,
  ])

  const handleCancel = useCallback(() => {
    resetFlow()
  }, [resetFlow])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,.pdf,application/pdf,text/csv,text/plain"
        hidden
        onChange={handleFileSelection}
      />

      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isProcessing || hasParsedPositions}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProcessing ? 'Importando...' : 'Importar B3'}
        </button>

        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}
      </div>

      {preview ? (
        <Suspense fallback={null}>
          <B3ImportModal
            preview={preview}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </Suspense>
      ) : null}
    </>
  )
}
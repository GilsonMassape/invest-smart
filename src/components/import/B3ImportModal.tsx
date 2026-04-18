import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { B3ImportMode, B3ImportPreview } from '../../domain/import/b3Import'

interface B3ImportModalProps {
  preview: B3ImportPreview
  selectedMode: B3ImportMode
  onModeChange: (mode: B3ImportMode) => void
  onConfirm: () => void
  onCancel: () => void
}

type PreviewStatus = 'NEW' | 'UPDATED' | 'UNCHANGED' | 'REMOVED'

const formatCountLabel = (
  value: number,
  singular: string,
  plural: string
): string => `${value} ${value === 1 ? singular : plural}`

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('pt-BR').format(value)

const STATUS_LABEL: Record<PreviewStatus, string> = {
  NEW: 'Novo',
  UPDATED: 'Atualizado',
  UNCHANGED: 'Inalterado',
  REMOVED: 'Removido',
}

const STATUS_TONE: Record<PreviewStatus, string> = {
  NEW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  UPDATED: 'border-blue-200 bg-blue-50 text-blue-700',
  UNCHANGED: 'border-slate-200 bg-slate-100 text-slate-600',
  REMOVED: 'border-red-200 bg-red-50 text-red-700',
}

function SummaryChip({
  label,
  tone,
}: {
  label: string
  tone: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  )
}

function ModeButton({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={[
        'inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition',
        isActive
          ? 'bg-slate-950 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ].join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export const B3ImportModal = ({
  preview,
  selectedMode,
  onModeChange,
  onConfirm,
  onCancel,
}: B3ImportModalProps) => {
  const totalItems = preview.items.length
  const newCount = preview.items.filter((item) => item.status === 'NEW').length
  const updatedCount = preview.items.filter(
    (item) => item.status === 'UPDATED'
  ).length
  const unchangedCount = preview.items.filter(
    (item) => item.status === 'UNCHANGED'
  ).length
  const removedCount = preview.items.filter(
    (item) => item.status === 'REMOVED'
  ).length

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="b3-import-title"
      aria-describedby="b3-import-description"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2
                    id="b3-import-title"
                    className="text-xl font-semibold tracking-tight text-slate-950"
                  >
                    Importar carteira da B3
                  </h2>

                  <p
                    id="b3-import-description"
                    className="max-w-2xl text-sm leading-6 text-slate-500"
                  >
                    Revise os ativos detectados antes de aplicar a importação.
                    O preview abaixo mostra como cada posição ficará após a
                    confirmação.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Fechar modal"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <SummaryChip
                  label={formatCountLabel(
                    totalItems,
                    'ativo detectado',
                    'ativos detectados'
                  )}
                  tone="border-slate-200 bg-slate-100 text-slate-700"
                />

                <SummaryChip
                  label={formatCountLabel(newCount, 'novo', 'novos')}
                  tone={STATUS_TONE.NEW}
                />

                <SummaryChip
                  label={formatCountLabel(
                    updatedCount,
                    'atualizado',
                    'atualizados'
                  )}
                  tone={STATUS_TONE.UPDATED}
                />

                {unchangedCount > 0 ? (
                  <SummaryChip
                    label={formatCountLabel(
                      unchangedCount,
                      'inalterado',
                      'inalterados'
                    )}
                    tone={STATUS_TONE.UNCHANGED}
                  />
                ) : null}

                {removedCount > 0 ? (
                  <SummaryChip
                    label={formatCountLabel(
                      removedCount,
                      'removido',
                      'removidos'
                    )}
                    tone={STATUS_TONE.REMOVED}
                  />
                ) : null}
              </div>
            </div>

            <div
              className="inline-flex w-full flex-wrap gap-3 xl:w-auto"
              role="tablist"
              aria-label="Modo de importação"
            >
              <ModeButton
                label="Mesclar"
                isActive={selectedMode === 'MERGE'}
                onClick={() => onModeChange('MERGE')}
              />
              <ModeButton
                label="Substituir"
                isActive={selectedMode === 'REPLACE'}
                onClick={() => onModeChange('REPLACE')}
              />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/70 px-5 py-5 sm:px-6">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="grid min-w-[880px] grid-cols-[minmax(140px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)] gap-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span>Ticker</span>
                <span className="text-right">Atual</span>
                <span className="text-right">Importado</span>
                <span className="text-right">Resultado</span>
                <span className="text-center">Status</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {preview.items.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 py-16">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Nenhum ativo encontrado
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      O arquivo importado não gerou itens para pré-visualização.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="min-w-[880px] divide-y divide-slate-100">
                  {preview.items.map((item) => {
                    const status = item.status as PreviewStatus

                    return (
                      <div
                        key={item.ticker}
                        className="grid grid-cols-[minmax(140px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)] items-center gap-4 px-5 py-4 text-sm transition hover:bg-slate-50/80"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {item.ticker}
                          </p>
                        </div>

                        <div className="text-right font-medium tabular-nums text-slate-600">
                          {formatQuantity(item.currentQuantity)}
                        </div>

                        <div className="text-right font-medium tabular-nums text-slate-600">
                          {formatQuantity(item.importedQuantity)}
                        </div>

                        <div className="text-right font-semibold tabular-nums text-slate-950">
                          {formatQuantity(item.resultQuantity)}
                        </div>

                        <div className="flex justify-center">
                          <span
                            className={`inline-flex min-w-[110px] items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_TONE[status]}`}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Modo atual:{' '}
              <span className="font-semibold text-slate-700">
                {selectedMode === 'MERGE'
                  ? 'Mesclar posições'
                  : 'Substituir carteira'}
              </span>
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={onCancel}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={onConfirm}
              >
                Confirmar importação
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
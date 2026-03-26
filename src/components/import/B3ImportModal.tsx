import type { B3ImportMode, B3ImportPreview } from '../../domain/import/b3Import';

interface B3ImportModalProps {
  preview: B3ImportPreview;
  selectedMode: B3ImportMode;
  onModeChange: (mode: B3ImportMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const formatCountLabel = (value: number, singular: string, plural: string): string =>
  `${value} ${value === 1 ? singular : plural}`;

export const B3ImportModal = ({
  preview,
  selectedMode,
  onModeChange,
  onConfirm,
  onCancel,
}: B3ImportModalProps) => {
  const totalItems = preview.items.length;
  const newCount = preview.items.filter((item) => item.status === 'NEW').length;
  const updatedCount = preview.items.filter((item) => item.status === 'UPDATED').length;
  const unchangedCount = preview.items.filter((item) => item.status === 'UNCHANGED').length;
  const removedCount = preview.items.filter((item) => item.status === 'REMOVED').length;

  return (
    <div className="b3-import-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="b3-import-title">
      <div className="b3-import-modal">
        <header className="b3-import-modal__header">
          <div className="b3-import-modal__title-block">
            <h2 id="b3-import-title">Importar carteira da B3</h2>
            <p>Revise os ativos detectados antes de aplicar a importação.</p>
          </div>

          <div className="b3-import-modal__summary">
            <span className="b3-import-modal__summary-badge">
              {formatCountLabel(totalItems, 'ativo detectado', 'ativos detectados')}
            </span>
            <span className="b3-import-modal__summary-chip b3-import-modal__summary-chip--new">
              {formatCountLabel(newCount, 'novo', 'novos')}
            </span>
            <span className="b3-import-modal__summary-chip b3-import-modal__summary-chip--updated">
              {formatCountLabel(updatedCount, 'atualizado', 'atualizados')}
            </span>
            {unchangedCount > 0 ? (
              <span className="b3-import-modal__summary-chip b3-import-modal__summary-chip--unchanged">
                {formatCountLabel(unchangedCount, 'inalterado', 'inalterados')}
              </span>
            ) : null}
            {removedCount > 0 ? (
              <span className="b3-import-modal__summary-chip b3-import-modal__summary-chip--removed">
                {formatCountLabel(removedCount, 'removido', 'removidos')}
              </span>
            ) : null}
          </div>
        </header>

        <div className="b3-import-modal__toolbar">
          <div className="b3-import-modal__mode-switch" role="tablist" aria-label="Modo de importação">
            <button
              type="button"
              className={selectedMode === 'MERGE' ? 'is-active' : ''}
              onClick={() => onModeChange('MERGE')}
            >
              Mesclar
            </button>
            <button
              type="button"
              className={selectedMode === 'REPLACE' ? 'is-active' : ''}
              onClick={() => onModeChange('REPLACE')}
            >
              Substituir
            </button>
          </div>
        </div>

        <div className="b3-import-modal__table-shell">
          <div className="b3-import-modal__table-scroll">
            <table className="b3-import-modal__table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Atual</th>
                  <th>Importado</th>
                  <th>Resultado</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.ticker}>
                    <td>{item.ticker}</td>
                    <td>{item.currentQuantity}</td>
                    <td>{item.importedQuantity}</td>
                    <td>{item.resultQuantity}</td>
                    <td>
                      <span
                        className={`b3-import-modal__status b3-import-modal__status--${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="b3-import-modal__footer">
          <button type="button" className="b3-import-modal__secondary-action" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="b3-import-modal__primary-action" onClick={onConfirm}>
            Confirmar importação
          </button>
        </footer>
      </div>
    </div>
  );
};
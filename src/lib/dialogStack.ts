import * as React from "react";

/**
 * Empilhamento automático de diálogos.
 *
 * Cada Dialog/AlertDialog aberto recebe um z-index maior que o anterior,
 * garantindo que modais abertos a partir de outro modal (ex.: upload de anexos
 * dentro do modal do sócio) sempre apareçam na frente e recebam os cliques.
 */
const BASE_Z_INDEX = 1000;
const STEP = 10;

let nextLayer = 0;
const DialogLayerContext = React.createContext(BASE_Z_INDEX);

export function useDialogLayer(open: boolean): number {
  const [zIndex, setZIndex] = React.useState(BASE_Z_INDEX);

  React.useEffect(() => {
    if (!open) return;

    nextLayer += 1;
    setZIndex(BASE_Z_INDEX + nextLayer * STEP);
  }, [open]);

  return zIndex;
}

export const DialogLayerProvider = DialogLayerContext.Provider;

export function useCurrentDialogLayer(offset = 2): number {
  return React.useContext(DialogLayerContext) + offset;
}

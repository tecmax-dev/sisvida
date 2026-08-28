import * as React from "react";

/**
 * Empilhamento automático de diálogos.
 *
 * Cada Dialog/AlertDialog aberto recebe um z-index maior que o anterior,
 * garantindo que modais abertos a partir de outro modal (ex.: upload de anexos
 * dentro do modal do sócio) sempre apareçam na frente e recebam os cliques.
 */
const BASE_Z_INDEX = 100;
const STEP = 10;

let openLayers = 0;

export function useDialogLayer(): number {
  const [zIndex] = React.useState(() => {
    openLayers += 1;
    return BASE_Z_INDEX + openLayers * STEP;
  });

  React.useEffect(() => {
    return () => {
      openLayers = Math.max(0, openLayers - 1);
    };
  }, []);

  return zIndex;
}

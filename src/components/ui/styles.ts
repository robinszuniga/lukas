/** Clases compartidas para que todos los formularios y botones se vean y se comporten igual. */

export const inputClass =
  'w-full min-w-0 bg-bg-elevated border border-bg-field rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-450 outline-none focus:border-accent-indigo transition-colors'

/** Botón de solo icono: área táctil de 36 px y color con contraste suficiente */
export const iconButton =
  'inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg text-gray-400 hover:text-white hover:bg-bg-elevated transition-colors'

export const primaryButton =
  'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

export const secondaryButton =
  'flex-1 py-2.5 px-4 rounded-xl text-sm text-gray-200 bg-bg-elevated border border-bg-field hover:border-gray-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

export const dangerButton =
  'flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-rose-700 hover:bg-rose-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

/** Pestaña dentro de un grupo (role="tablist") */
export function tabClass(active: boolean): string {
  return `shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
  }`
}

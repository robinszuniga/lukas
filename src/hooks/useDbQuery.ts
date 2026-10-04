import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { onDataChange } from '@/lib/db'

/**
 * Lee de la base y vuelve a leer cada vez que los datos cambian (crear, editar,
 * eliminar, pagar, deshacer, importar…). Así cualquier pantalla abierta queda al día
 * sin que cada acción tenga que acordarse de refrescar a las demás.
 *
 * Solo muestra "cargando" la primera vez: en las siguientes lecturas se conserva lo
 * que ya se ve en pantalla hasta que llega el dato nuevo (sin parpadeos).
 */
export function useDbQuery<T>(load: () => Promise<T>, initial: T, deps: DependencyList = []) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refresh = useCallback(async () => {
    const mine = ++sequence.current
    try {
      const result = await load()
      // Si mientras tanto se pidió otra lectura, esta respuesta ya es vieja
      if (mine !== sequence.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (mine !== sequence.current) return
      setError((err as Error)?.message ?? 'No se pudieron leer los datos')
    } finally {
      if (mine === sequence.current) setLoading(false)
    }
  }, deps)

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => onDataChange(() => { refresh() }), [refresh])

  return { data, loading, error, refresh }
}

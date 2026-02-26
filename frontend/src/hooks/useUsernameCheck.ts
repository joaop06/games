import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

const DEBOUNCE_MS = 300
const MIN_LENGTH = 2

/**
 * Debounced username existence check. Only calls API when normalized value
 * has length >= MIN_LENGTH. Cancels in-flight request when value changes.
 */
export function useUsernameCheck(normalizedValue: string): {
  exists: boolean | null
  loading: boolean
} {
  const [exists, setExists] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const lastRequestRef = useRef(0)

  useEffect(() => {
    if (normalizedValue.length < MIN_LENGTH) {
      setExists(null)
      setLoading(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      const reqId = ++lastRequestRef.current
      setLoading(true)
      try {
        const res = await api.checkUsername(normalizedValue)
        if (reqId === lastRequestRef.current) {
          setExists(res.exists)
        }
      } catch {
        if (reqId === lastRequestRef.current) {
          setExists(null)
        }
      } finally {
        if (reqId === lastRequestRef.current) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [normalizedValue])

  return { exists, loading }
}

import { useEffect, useState } from 'react'
import { getServerState, subscribeServer } from '@/services/server.store'

export const useServerState = () => {
  const [state, setState] = useState(getServerState())

  useEffect(() => {
    return subscribeServer(setState)
  }, [])

  return state
}

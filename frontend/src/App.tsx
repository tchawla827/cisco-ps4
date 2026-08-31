import { useEffect, useState } from 'react'

import { loadDepartment } from './api/department'
import type { DepartmentView } from './types/department'

function App() {
  const [department, setDepartment] = useState<DepartmentView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadDepartment('main-12').then(setDepartment).catch((apiError: unknown) => {
      setError(apiError instanceof Error ? apiError.message : 'Unable to load department')
    })
  }, [])

  if (error) {
    return <pre>{error}</pre>
  }

  return <pre>{department ? JSON.stringify(department, null, 2) : 'Loading department...'}</pre>
}

export default App

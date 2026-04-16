import { createContext, useContext, useState } from 'react'

const DeptContext = createContext(null)

export function DeptProvider({ children }) {
  // null = all departments
  const [activeDept, setActiveDept] = useState(null)

  return (
    <DeptContext.Provider value={{ activeDept, setActiveDept }}>
      {children}
    </DeptContext.Provider>
  )
}

export const useDept = () => useContext(DeptContext)

import { useAuth } from '../context/AuthContext'

/**
 * Returns true if the logged-in user has the given permission.
 * resource: 'invoices' | 'expenses' | 'users' | 'reports' | etc.
 * action:   'read' | 'write' | 'delete'
 */
export function usePermission(resource, action) {
  const { user } = useAuth()
  if (!user?.permissions) return false

  // Wildcard admin
  const all = user.permissions['*'] || []
  if (all.includes('*') || all.includes(action)) return true

  // Resource-specific
  const perms = user.permissions[resource] || []
  return perms.includes(action) || perms.includes('*')
}

/**
 * Returns an object of can.read / can.write / can.delete for a resource
 */
export function useResourcePerms(resource) {
  return {
    read:   usePermission(resource, 'read'),
    write:  usePermission(resource, 'write'),
    delete: usePermission(resource, 'delete'),
  }
}

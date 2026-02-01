interface EstadoBadgeProps {
  activo: boolean
}

export function EstadoBadge({ activo }: EstadoBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        activo
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

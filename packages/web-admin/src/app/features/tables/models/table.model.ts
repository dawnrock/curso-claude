export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  occupiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  description: string | null
  capacity: number
  status: TableStatus
}

export interface UpdateTableDto {
  number: number
  description: string | null
  capacity: number
  status: TableStatus
}

export const TABLE_STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada']

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada'
}

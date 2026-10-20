import {
    InvalidTableStatusError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

const VALID_TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const

export type TableStatusType = typeof VALID_TABLE_STATUSES[number]

export interface Table {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: TableStatusType
    occupiedAt: string | null
    createdAt: string
    updatedAt: string
}

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1

export function normalizeTableStatus(value: unknown): TableStatusType {
    const normalized = typeof value === 'string' ? value.toLowerCase().trim() : ''
    if (!VALID_TABLE_STATUSES.includes(normalized as TableStatusType)) {
        throw new InvalidTableStatusError(`Invalid table status: ${value}. Must be one of: ${VALID_TABLE_STATUSES.join(', ')}`)
    }
    return normalized as TableStatusType
}

export function normalizeTableNumber(value: unknown): number {
    if (!isPositiveInteger(value)) {
        throw new InvalidTableNumberError()
    }
    return value
}

export function normalizeTableCapacity(value: unknown): number {
    if (!isPositiveInteger(value)) {
        throw new InvalidTableCapacityError()
    }
    return value
}

export function normalizeTableDescription(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

export function normalizePeopleCount(value: unknown): number {
    const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
    if (!isPositiveInteger(parsed)) {
        throw new InvalidPeopleCountError()
    }
    return parsed
}

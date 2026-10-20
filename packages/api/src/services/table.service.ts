import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import {
    normalizeTableStatus,
    normalizeTableNumber,
    normalizeTableCapacity,
    normalizeTableDescription,
    normalizePeopleCount
} from '@models/table.model.js'
import type { Order } from '@models/order.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import type { RestaurantRepository } from '@repositories/restaurant.repository.js'
import type { OrderRepository, TableOccupation } from '@repositories/order.repository.js'
import {
    RestaurantNotFoundError,
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableOccupiedError,
    TableCapacityExceededError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

export type TableWithOrders = Table & { orders?: Order[] }

interface TableInput {
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

export class TableService {
    constructor(
        private readonly tableRepository: TableRepository,
        private readonly restaurantRepository: RestaurantRepository,
        private readonly orderRepository: OrderRepository
    ) {}

    async listByRestaurant(restaurantId: string, includeOrders = false): Promise<TableWithOrders[]> {
        await this.ensureRestaurantExists(restaurantId)
        const tables = await this.tableRepository.findByRestaurantId(restaurantId)
        if (!includeOrders) return tables

        const orders = await this.orderRepository.findByTablesSince(
            tables.flatMap(t => this.currentOccupation(t) ?? [])
        )
        return tables.map(t => ({ ...t, orders: orders.filter(o => o.tableId === t.id) }))
    }

    async listAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        const peopleCount = people === undefined ? null : normalizePeopleCount(people)
        await this.ensureRestaurantExists(restaurantId)
        return this.tableRepository.findAvailable(restaurantId, peopleCount)
    }

    async getById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async create(restaurantId: string, input: TableInput): Promise<Table> {
        const number = normalizeTableNumber(input.number)
        const capacity = normalizeTableCapacity(input.capacity)
        const status = input.status === undefined ? 'libre' : normalizeTableStatus(input.status)
        await this.ensureRestaurantExists(restaurantId)
        await this.ensureNumberIsFree(restaurantId, number, null)

        const now = new Date().toISOString()
        const table: Table = {
            id: randomUUID(),
            restaurantId,
            number,
            description: normalizeTableDescription(input.description),
            capacity,
            status,
            occupiedAt: status === 'ocupada' ? now : null,
            createdAt: now,
            updatedAt: now
        }

        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, input: TableInput): Promise<Table> {
        const existing = await this.getById(restaurantId, id)
        const number = normalizeTableNumber(input.number)
        const capacity = normalizeTableCapacity(input.capacity)
        const status = input.status === undefined ? existing.status : normalizeTableStatus(input.status)
        await this.ensureNumberIsFree(restaurantId, number, id)

        const now = new Date().toISOString()
        const updated: Table = {
            ...existing,
            number,
            description: normalizeTableDescription(input.description),
            capacity,
            status,
            occupiedAt: this.nextOccupiedAt(existing, status, now),
            updatedAt: now
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async updateStatus(restaurantId: string, id: string, status: unknown): Promise<Table> {
        const existing = await this.getById(restaurantId, id)
        const newStatus = normalizeTableStatus(status)

        const now = new Date().toISOString()
        const updated: Table = {
            ...existing,
            status: newStatus,
            occupiedAt: this.nextOccupiedAt(existing, newStatus, now),
            updatedAt: now
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const table = await this.getById(restaurantId, id)
        if (table.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async occupy(restaurantId: string, id: string, people: unknown): Promise<Table> {
        // The body must carry a JSON number; numeric strings are only accepted in query params
        if (typeof people !== 'number') {
            throw new InvalidPeopleCountError()
        }
        const peopleCount = normalizePeopleCount(people)
        const table = await this.getById(restaurantId, id)
        if (table.status !== 'libre') {
            throw new TableNotAvailableError()
        }
        if (peopleCount > table.capacity) {
            throw new TableCapacityExceededError()
        }

        const occupied = await this.tableRepository.occupyIfFree(id, new Date().toISOString())
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return this.getById(restaurantId, id)
    }

    async listOrders(restaurantId: string, id: string): Promise<Order[]> {
        const table = await this.getById(restaurantId, id)
        const occupation = this.currentOccupation(table)
        return occupation ? this.orderRepository.findByTablesSince([occupation]) : []
    }

    private currentOccupation(table: Table): TableOccupation | null {
        if (table.status !== 'ocupada' || !table.occupiedAt) return null
        return { tableId: table.id, since: table.occupiedAt }
    }

    private async ensureRestaurantExists(restaurantId: string): Promise<void> {
        const restaurant = await this.restaurantRepository.findById(restaurantId)
        if (!restaurant) {
            throw new RestaurantNotFoundError()
        }
    }

    private async ensureNumberIsFree(restaurantId: string, number: number, currentId: string | null): Promise<void> {
        const sameNumber = await this.tableRepository.findByNumber(restaurantId, number)
        if (sameNumber && sameNumber.id !== currentId) {
            throw new DuplicatedTableNumberError()
        }
    }

    private nextOccupiedAt(current: Table, status: TableStatusType, now: string): string | null {
        if (status !== 'ocupada') return null
        return current.status === 'ocupada' ? current.occupiedAt : now
    }
}

import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import type { Table } from '@models/table.model.js'
import type { Order } from '@models/order.model.js'
import {
    RestaurantNotFoundError,
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    InvalidPeopleCountError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableOccupiedError,
    TableCapacityExceededError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let tableRepo: MockTableRepository
    let restaurantRepo: MockRestaurantRepository
    let orderRepo: MockOrderRepository
    let service: TableService

    const past = '2026-01-01T10:00:00.000Z'

    const buildTable = (overrides: Partial<Table> = {}): Table => ({
        id: 't1',
        restaurantId: 'rest-1',
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        occupiedAt: null,
        createdAt: past,
        updatedAt: past,
        ...overrides
    })

    beforeEach(async () => {
        tableRepo = new MockTableRepository()
        restaurantRepo = new MockRestaurantRepository()
        orderRepo = new MockOrderRepository()
        service = new TableService(tableRepo, restaurantRepo, orderRepo)

        for (const id of ['rest-1', 'rest-2']) {
            await restaurantRepo.save({
                id,
                name: 'R',
                address: 'A',
                email: 'r@r.com',
                phone: '600000000',
                ownerFirstName: 'O',
                ownerLastName: 'L',
                logoUrl: null,
                createdAt: past,
                updatedAt: past
            })
        }
    })

    describe('listByRestaurant', () => {
        it('should list the tables of the restaurant', async () => {
            await tableRepo.save(buildTable({ id: 't2', number: 2 }))
            await tableRepo.save(buildTable({ id: 't1', number: 1 }))
            await tableRepo.save(buildTable({ id: 'other', restaurantId: 'rest-2' }))

            const tables = await service.listByRestaurant('rest-1')
            expect(tables.map(t => t.id)).toEqual(['t1', 't2'])
        })

        it('should throw RestaurantNotFoundError for an unknown restaurant', async () => {
            await expect(service.listByRestaurant('nope')).rejects.toThrow(RestaurantNotFoundError)
        })

        it('should not include orders by default', async () => {
            await tableRepo.save(buildTable())

            const [table] = await service.listByRestaurant('rest-1')
            expect(table).not.toHaveProperty('orders')
        })

        it('should embed the orders of the current occupation of each table when asked', async () => {
            await tableRepo.save(buildTable({ id: 't1', number: 1, status: 'ocupada', occupiedAt: '2026-01-01T12:00:00.000Z' }))
            await tableRepo.save(buildTable({ id: 't2', number: 2, status: 'ocupada', occupiedAt: '2026-01-01T13:00:00.000Z' }))
            await tableRepo.save(buildTable({ id: 't3', number: 3 }))
            const order = (id: string, tableId: string, createdAt: string): Order => ({
                id, restaurantId: 'rest-1', tableId, clientId: null, createdAt: new Date(createdAt), items: []
            })
            await orderRepo.create(order('t1-second', 't1', '2026-01-01T12:30:00.000Z'))
            await orderRepo.create(order('t1-first', 't1', '2026-01-01T12:10:00.000Z'))
            await orderRepo.create(order('t2-previous-guests', 't2', '2026-01-01T12:30:00.000Z'))
            await orderRepo.create(order('t3-old', 't3', '2026-01-01T12:30:00.000Z'))

            const tables = await service.listByRestaurant('rest-1', true)

            expect(tables.map(t => [t.id, t.orders?.map(o => o.id)])).toEqual([
                ['t1', ['t1-first', 't1-second']],
                ['t2', []],
                ['t3', []]
            ])
        })
    })

    describe('listAvailable', () => {
        beforeEach(async () => {
            await tableRepo.save(buildTable({ id: 'two', number: 1, capacity: 2 }))
            await tableRepo.save(buildTable({ id: 'six', number: 2, capacity: 6 }))
            await tableRepo.save(buildTable({ id: 'busy', number: 3, capacity: 6, status: 'ocupada', occupiedAt: past }))
        })

        it('should list free tables with enough capacity', async () => {
            const tables = await service.listAvailable('rest-1', '3')
            expect(tables.map(t => t.id)).toEqual(['six'])
        })

        it('should list every free table when people is not sent', async () => {
            const tables = await service.listAvailable('rest-1', undefined)
            expect(tables.map(t => t.id)).toEqual(['two', 'six'])
        })

        it('should throw InvalidPeopleCountError for an invalid people count', async () => {
            await expect(service.listAvailable('rest-1', '0')).rejects.toThrow(InvalidPeopleCountError)
        })

        it('should throw RestaurantNotFoundError for an unknown restaurant', async () => {
            await expect(service.listAvailable('nope', undefined)).rejects.toThrow(RestaurantNotFoundError)
        })
    })

    describe('getById', () => {
        it('should return the table', async () => {
            await tableRepo.save(buildTable())
            expect((await service.getById('rest-1', 't1')).id).toBe('t1')
        })

        it('should throw TableNotFoundError for an unknown table', async () => {
            await expect(service.getById('rest-1', 'nope')).rejects.toThrow(TableNotFoundError)
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            await tableRepo.save(buildTable())
            await expect(service.getById('rest-2', 't1')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('create', () => {
        it('should create a free table by default', async () => {
            const table = await service.create('rest-1', { number: 5, capacity: 6, description: ' Terraza ' })

            expect(table.id).toBeDefined()
            expect(table).toMatchObject({
                restaurantId: 'rest-1',
                number: 5,
                capacity: 6,
                description: 'Terraza',
                status: 'libre',
                occupiedAt: null
            })
            expect(await tableRepo.findById(table.id)).toEqual(table)
        })

        it('should set occupiedAt when created as ocupada', async () => {
            const table = await service.create('rest-1', { number: 5, capacity: 6, status: 'OCUPADA' })

            expect(table.status).toBe('ocupada')
            expect(table.occupiedAt).not.toBeNull()
        })

        it('should validate number, capacity and status', async () => {
            await expect(service.create('rest-1', { number: 0, capacity: 2 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.create('rest-1', { number: 1, capacity: 1.5 })).rejects.toThrow(InvalidTableCapacityError)
            await expect(service.create('rest-1', { number: 1, capacity: 2, status: 'sucia' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw DuplicatedTableNumberError if the number is taken in the restaurant', async () => {
            await tableRepo.save(buildTable({ number: 5 }))

            await expect(service.create('rest-1', { number: 5, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
            await expect(service.create('rest-2', { number: 5, capacity: 2 })).resolves.toBeDefined()
        })

        it('should throw RestaurantNotFoundError for an unknown restaurant', async () => {
            await expect(service.create('nope', { number: 1, capacity: 2 })).rejects.toThrow(RestaurantNotFoundError)
        })
    })

    describe('update', () => {
        beforeEach(async () => {
            await tableRepo.save(buildTable({ description: 'Ventana' }))
        })

        it('should replace number, capacity and description and keep the status if omitted', async () => {
            await tableRepo.save(buildTable({ description: 'Ventana', status: 'ocupada', occupiedAt: past }))

            const table = await service.update('rest-1', 't1', { number: 9, capacity: 8 })

            expect(table).toMatchObject({ number: 9, capacity: 8, description: null, status: 'ocupada', occupiedAt: past, createdAt: past })
            expect(table.updatedAt).not.toBe(past)
        })

        it('should apply the occupiedAt rules when the status is sent', async () => {
            const occupied = await service.update('rest-1', 't1', { number: 1, capacity: 4, status: 'ocupada' })
            expect(occupied.occupiedAt).not.toBeNull()

            const freed = await service.update('rest-1', 't1', { number: 1, capacity: 4, status: 'libre' })
            expect(freed.occupiedAt).toBeNull()
        })

        it('should allow keeping the same number', async () => {
            await expect(service.update('rest-1', 't1', { number: 1, capacity: 2 })).resolves.toBeDefined()
        })

        it('should throw DuplicatedTableNumberError if another table has the number', async () => {
            await tableRepo.save(buildTable({ id: 't2', number: 2 }))
            await expect(service.update('rest-1', 't1', { number: 2, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            await expect(service.update('rest-2', 't1', { number: 1, capacity: 2 })).rejects.toThrow(TableNotFoundError)
        })

        it('should validate the input', async () => {
            await expect(service.update('rest-1', 't1', { number: 1, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
        })
    })

    describe('updateStatus', () => {
        it('should set occupiedAt when a table becomes ocupada', async () => {
            await tableRepo.save(buildTable())

            const table = await service.updateStatus('rest-1', 't1', 'ocupada')

            expect(table.status).toBe('ocupada')
            expect(table.occupiedAt).not.toBeNull()
            expect((await tableRepo.findById('t1'))?.status).toBe('ocupada')
        })

        it('should keep occupiedAt when an ocupada table is set to ocupada again', async () => {
            await tableRepo.save(buildTable({ status: 'ocupada', occupiedAt: past }))

            const table = await service.updateStatus('rest-1', 't1', 'ocupada')
            expect(table.occupiedAt).toBe(past)
        })

        it('should clear occupiedAt for any other status', async () => {
            await tableRepo.save(buildTable({ status: 'ocupada', occupiedAt: past }))

            const table = await service.updateStatus('rest-1', 't1', 'reservada')
            expect(table.status).toBe('reservada')
            expect(table.occupiedAt).toBeNull()
        })

        it('should throw InvalidTableStatusError for an invalid status', async () => {
            await tableRepo.save(buildTable())
            await expect(service.updateStatus('rest-1', 't1', 'sucia')).rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw TableNotFoundError for an unknown table', async () => {
            await expect(service.updateStatus('rest-1', 'nope', 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('should delete a free or reserved table', async () => {
            await tableRepo.save(buildTable())
            await tableRepo.save(buildTable({ id: 't2', number: 2, status: 'reservada' }))

            await service.delete('rest-1', 't1')
            await service.delete('rest-1', 't2')

            expect(await tableRepo.findByRestaurantId('rest-1')).toEqual([])
        })

        it('should throw TableOccupiedError for an ocupada table', async () => {
            await tableRepo.save(buildTable({ status: 'ocupada', occupiedAt: past }))

            await expect(service.delete('rest-1', 't1')).rejects.toThrow(TableOccupiedError)
            expect(await tableRepo.findById('t1')).not.toBeNull()
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            await tableRepo.save(buildTable())
            await expect(service.delete('rest-2', 't1')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('occupy', () => {
        it('should occupy a free table with enough capacity', async () => {
            await tableRepo.save(buildTable({ capacity: 4 }))

            const table = await service.occupy('rest-1', 't1', 4)

            expect(table.status).toBe('ocupada')
            expect(table.occupiedAt).not.toBeNull()
        })

        it('should throw TableNotAvailableError if the table is not free', async () => {
            await tableRepo.save(buildTable({ status: 'reservada' }))
            await expect(service.occupy('rest-1', 't1', 2)).rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableNotAvailableError if another client wins the race', async () => {
            await tableRepo.save(buildTable())
            tableRepo.occupyIfFree = async () => false

            await expect(service.occupy('rest-1', 't1', 2)).rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableCapacityExceededError if there are more people than seats', async () => {
            await tableRepo.save(buildTable({ capacity: 2 }))
            await expect(service.occupy('rest-1', 't1', 3)).rejects.toThrow(TableCapacityExceededError)
        })

        it('should throw InvalidPeopleCountError for an invalid people count', async () => {
            await tableRepo.save(buildTable())
            await expect(service.occupy('rest-1', 't1', 0)).rejects.toThrow(InvalidPeopleCountError)
            await expect(service.occupy('rest-1', 't1', '2')).rejects.toThrow(InvalidPeopleCountError)
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            await tableRepo.save(buildTable())
            await expect(service.occupy('rest-2', 't1', 2)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('listOrders', () => {
        const buildOrder = (id: string, tableId: string | null, createdAt: string): Order => ({
            id,
            restaurantId: 'rest-1',
            tableId,
            clientId: null,
            createdAt: new Date(createdAt),
            items: []
        })

        it('should list the orders of the current occupation, oldest first', async () => {
            await tableRepo.save(buildTable({ status: 'ocupada', occupiedAt: '2026-01-01T12:00:00.000Z' }))
            await orderRepo.create(buildOrder('previous-guests', 't1', '2026-01-01T11:00:00.000Z'))
            await orderRepo.create(buildOrder('second', 't1', '2026-01-01T12:30:00.000Z'))
            await orderRepo.create(buildOrder('first', 't1', '2026-01-01T12:00:00.000Z'))
            await orderRepo.create(buildOrder('other-table', 't2', '2026-01-01T12:10:00.000Z'))

            const orders = await service.listOrders('rest-1', 't1')
            expect(orders.map(o => o.id)).toEqual(['first', 'second'])
        })

        it('should return an empty list if the table is not ocupada', async () => {
            await tableRepo.save(buildTable())
            await orderRepo.create(buildOrder('old', 't1', '2026-01-01T11:00:00.000Z'))

            expect(await service.listOrders('rest-1', 't1')).toEqual([])
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            await tableRepo.save(buildTable())
            await expect(service.listOrders('rest-2', 't1')).rejects.toThrow(TableNotFoundError)
        })
    })
})

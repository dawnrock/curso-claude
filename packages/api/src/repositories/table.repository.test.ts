import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { DuplicatedTableNumberError } from '@errors/DomainErrors.js'
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    const now = new Date().toISOString()

    const buildTable = (overrides: Partial<Table> = {}): Table => ({
        id: 't1',
        restaurantId: 'r1',
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        occupiedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides
    })

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        for (const id of ['r1', 'r2']) {
            await db.run(
                `INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
                 VALUES (?, 'R', 'A', 'r@r.com', '600000000', 'O', 'L', ?, ?)`,
                [id, now, now]
            )
        }
    })

    beforeEach(async () => {
        await db.run('DELETE FROM tables')
    })

    afterAll(async () => {
        await db.close()
    })

    it('should save and find a table by id', async () => {
        await repo.save(buildTable({ description: 'Terraza' }))

        const found = await repo.findById('t1')
        expect(found).toEqual(buildTable({ description: 'Terraza' }))
    })

    it('should return null for an unknown id', async () => {
        expect(await repo.findById('nope')).toBeNull()
    })

    it('should update an existing table', async () => {
        await repo.save(buildTable())
        await repo.save(buildTable({ number: 7, capacity: 6, status: 'ocupada', occupiedAt: now }))

        const found = await repo.findById('t1')
        expect(found?.number).toBe(7)
        expect(found?.capacity).toBe(6)
        expect(found?.status).toBe('ocupada')
        expect(found?.occupiedAt).toBe(now)
    })

    it('should list the tables of a restaurant sorted by number', async () => {
        await repo.save(buildTable({ id: 't3', number: 3 }))
        await repo.save(buildTable({ id: 't1', number: 1 }))
        await repo.save(buildTable({ id: 'other', restaurantId: 'r2', number: 2 }))

        const tables = await repo.findByRestaurantId('r1')
        expect(tables.map(t => t.id)).toEqual(['t1', 't3'])
    })

    it('should find a table by restaurant and number', async () => {
        await repo.save(buildTable({ id: 't5', number: 5 }))

        expect((await repo.findByNumber('r1', 5))?.id).toBe('t5')
        expect(await repo.findByNumber('r2', 5)).toBeNull()
    })

    it('should list free tables with enough capacity sorted by capacity and number', async () => {
        await repo.save(buildTable({ id: 'big', number: 1, capacity: 8 }))
        await repo.save(buildTable({ id: 'small', number: 2, capacity: 2 }))
        await repo.save(buildTable({ id: 'mid-b', number: 4, capacity: 4 }))
        await repo.save(buildTable({ id: 'mid-a', number: 3, capacity: 4 }))
        await repo.save(buildTable({ id: 'busy', number: 5, capacity: 6, status: 'ocupada', occupiedAt: now }))
        await repo.save(buildTable({ id: 'booked', number: 6, capacity: 6, status: 'reservada' }))

        const forThree = await repo.findAvailable('r1', 3)
        expect(forThree.map(t => t.id)).toEqual(['mid-a', 'mid-b', 'big'])

        const any = await repo.findAvailable('r1', null)
        expect(any.map(t => t.id)).toEqual(['small', 'mid-a', 'mid-b', 'big'])
    })

    it('should throw DuplicatedTableNumberError when the number is taken in the restaurant', async () => {
        await repo.save(buildTable({ id: 't1', number: 1 }))

        await expect(repo.save(buildTable({ id: 't2', number: 1 }))).rejects.toThrow(DuplicatedTableNumberError)
        await expect(repo.save(buildTable({ id: 't3', restaurantId: 'r2', number: 1 }))).resolves.toBeUndefined()
    })

    it('should delete a table', async () => {
        await repo.save(buildTable())
        await repo.delete('t1')

        expect(await repo.findById('t1')).toBeNull()
    })

    describe('occupyIfFree', () => {
        it('should occupy a free table and return true', async () => {
            await repo.save(buildTable())
            const at = new Date().toISOString()

            expect(await repo.occupyIfFree('t1', at)).toBe(true)

            const found = await repo.findById('t1')
            expect(found?.status).toBe('ocupada')
            expect(found?.occupiedAt).toBe(at)
            expect(found?.updatedAt).toBe(at)
        })

        it('should return false and change nothing if the table is not free', async () => {
            await repo.save(buildTable({ status: 'reservada' }))

            expect(await repo.occupyIfFree('t1', new Date().toISOString())).toBe(false)
            expect((await repo.findById('t1'))?.status).toBe('reservada')
        })

        it('should let only one of two concurrent calls win', async () => {
            await repo.save(buildTable())
            const at = new Date().toISOString()

            const results = await Promise.all([repo.occupyIfFree('t1', at), repo.occupyIfFree('t1', at)])
            expect(results.filter(Boolean)).toHaveLength(1)
        })
    })
})

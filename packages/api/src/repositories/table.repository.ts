import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import { DuplicatedTableNumberError } from '@errors/DomainErrors.js'

interface TableRow {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: string
    occupiedAt: string | null
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = `
    SELECT id, restaurant_id as restaurantId, number, description, capacity, status,
           occupied_at as occupiedAt, created_at as createdAt, updated_at as updatedAt
    FROM tables
`

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    findAvailable(restaurantId: string, people: number | null): Promise<Table[]>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
    occupyIfFree(id: string, occupiedAt: string): Promise<boolean>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private readonly db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE id = ?`, [id])
        return row ? this.mapToTable(row) : null
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE} WHERE restaurant_id = ? ORDER BY number ASC`,
            [restaurantId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(
            `${SELECT_TABLE} WHERE restaurant_id = ? AND number = ?`,
            [restaurantId, number]
        )
        return row ? this.mapToTable(row) : null
    }

    async findAvailable(restaurantId: string, people: number | null): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE} WHERE restaurant_id = ? AND status = 'libre' AND capacity >= ? ORDER BY capacity ASC, number ASC`,
            [restaurantId, people ?? 1]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async save(table: Table): Promise<void> {
        try {
            await this.db.run(
                `INSERT INTO tables (id, restaurant_id, number, description, capacity, status, occupied_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    number = excluded.number,
                    description = excluded.description,
                    capacity = excluded.capacity,
                    status = excluded.status,
                    occupied_at = excluded.occupied_at,
                    updated_at = excluded.updated_at`,
                [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status, table.occupiedAt, table.createdAt, table.updatedAt]
            )
        } catch (error: any) {
            if (error?.code === 'SQLITE_CONSTRAINT' && String(error.message).includes('tables.restaurant_id, tables.number')) {
                throw new DuplicatedTableNumberError()
            }
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM tables WHERE id = ?', [id])
    }

    async occupyIfFree(id: string, occupiedAt: string): Promise<boolean> {
        const result = await this.db.run(
            `UPDATE tables SET status = 'ocupada', occupied_at = ?, updated_at = ? WHERE id = ? AND status = 'libre'`,
            [occupiedAt, occupiedAt, id]
        )
        return result.changes === 1
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            restaurantId: row.restaurantId,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            occupiedAt: row.occupiedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}

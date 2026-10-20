import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'

const auth = new BcryptAuthService()
const tokenFor = (role: string, restaurantId: string | null) =>
    `Bearer ${auth.generateToken({ id: `${role}-${restaurantId}`, role, restaurantId })}`

const admin = tokenFor('admin', null)
const manager = tokenFor('manager', 'rest-1')
const waiter = tokenFor('camarero', 'rest-1')
const cook = tokenFor('cocinero', 'rest-1')
const otherManager = tokenFor('manager', 'rest-2')
const client = tokenFor('cliente', null)

const base = '/api/v1/restaurants/rest-1/tables'

describe('Table routes (Integration)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        const now = new Date().toISOString()
        for (const id of ['rest-1', 'rest-2']) {
            await dbConfig.run(
                `INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
                 VALUES (?, 'R', 'A', 'r@r.com', '600000000', 'O', 'L', ?, ?)`,
                [id, now, now]
            )
        }
        await dbConfig.run(
            `INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at)
             VALUES ('dish-1', 'Pizza', NULL, 10, 'principal', 1, 'rest-1', ?, ?)`,
            [now, now]
        )
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM order_items')
        await dbConfig.run('DELETE FROM orders')
        await dbConfig.run('DELETE FROM tables')
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    const createTable = async (body: object, restaurantId = 'rest-1') => {
        const res = await request(app)
            .post(`/api/v1/restaurants/${restaurantId}/tables`)
            .set('Authorization', admin)
            .send(body)
        expect(res.status).toBe(201)
        return res.body
    }

    describe('CRUD', () => {
        it('should create, get, list, update and delete a table', async () => {
            const created = await request(app).post(base).set('Authorization', manager)
                .send({ number: 5, capacity: 6, description: 'Terraza' })
            expect(created.status).toBe(201)
            expect(created.body).toMatchObject({
                restaurantId: 'rest-1', number: 5, capacity: 6, description: 'Terraza', status: 'libre', occupiedAt: null
            })
            const id = created.body.id

            const got = await request(app).get(`${base}/${id}`).set('Authorization', waiter)
            expect(got.status).toBe(200)
            expect(got.body).toEqual(created.body)

            const list = await request(app).get(base).set('Authorization', cook)
            expect(list.status).toBe(200)
            expect(list.body).toHaveLength(1)

            const updated = await request(app).put(`${base}/${id}`).set('Authorization', admin)
                .send({ number: 6, capacity: 8 })
            expect(updated.status).toBe(200)
            expect(updated.body).toMatchObject({ number: 6, capacity: 8, description: null, status: 'libre' })

            const deleted = await request(app).delete(`${base}/${id}`).set('Authorization', manager)
            expect(deleted.status).toBe(204)

            const gone = await request(app).get(`${base}/${id}`).set('Authorization', manager)
            expect(gone.status).toBe(404)
            expect(gone.body).toEqual({ error: 'TableNotFoundError', message: 'Table not found' })
        })

        it('should return 400 for invalid input', async () => {
            const res = await request(app).post(base).set('Authorization', admin).send({ number: 1, capacity: 0 })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidTableCapacityError')
        })

        it('should return 409 for a duplicated number', async () => {
            await createTable({ number: 1, capacity: 2 })

            const res = await request(app).post(base).set('Authorization', admin).send({ number: 1, capacity: 4 })
            expect(res.status).toBe(409)
            expect(res.body.error).toBe('DuplicatedTableNumberError')
        })

        it('should return 404 for an unknown restaurant', async () => {
            const res = await request(app).post('/api/v1/restaurants/nope/tables').set('Authorization', admin)
                .send({ number: 1, capacity: 2 })
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('RestaurantNotFoundError')
        })

        it('should return 409 when deleting an ocupada table', async () => {
            const table = await createTable({ number: 1, capacity: 2, status: 'ocupada' })

            const res = await request(app).delete(`${base}/${table.id}`).set('Authorization', admin)
            expect(res.status).toBe(409)
            expect(res.body.error).toBe('TableOccupiedError')
        })

        it('should report a table of another restaurant as not found', async () => {
            const table = await createTable({ number: 1, capacity: 2 }, 'rest-2')

            const res = await request(app).get(`${base}/${table.id}`).set('Authorization', admin)
            expect(res.status).toBe(404)
        })
    })

    describe('authorization', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get(base)
            expect(res.status).toBe(401)
        })

        it('should only let admin and manager manage tables', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            for (const token of [waiter, cook, client]) {
                expect((await request(app).post(base).set('Authorization', token).send({ number: 2, capacity: 2 })).status).toBe(403)
                expect((await request(app).put(`${base}/${table.id}`).set('Authorization', token).send({ number: 2, capacity: 2 })).status).toBe(403)
                expect((await request(app).delete(`${base}/${table.id}`).set('Authorization', token)).status).toBe(403)
            }
        })

        it('should not let clients read tables or change their status', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            expect((await request(app).get(base).set('Authorization', client)).status).toBe(403)
            expect((await request(app).patch(`${base}/${table.id}/status`).set('Authorization', client).send({ status: 'libre' })).status).toBe(403)
            expect((await request(app).get(`${base}/${table.id}/orders`).set('Authorization', client)).status).toBe(403)
        })

        it('should return 403 when an employee uses another restaurant', async () => {
            const res = await request(app).get(base).set('Authorization', otherManager)
            expect(res.status).toBe(403)
            expect(res.body).toEqual({ error: 'Forbidden: Restaurant mismatch' })
        })

        it('should only let clients occupy tables', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            const res = await request(app).post(`${base}/${table.id}/occupy`).set('Authorization', waiter).send({ people: 2 })
            expect(res.status).toBe(403)
        })
    })

    describe('PATCH /:id/status', () => {
        it('should change the status and manage occupiedAt', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            const occupied = await request(app).patch(`${base}/${table.id}/status`).set('Authorization', waiter).send({ status: 'ocupada' })
            expect(occupied.status).toBe(200)
            expect(occupied.body.status).toBe('ocupada')
            expect(occupied.body.occupiedAt).not.toBeNull()

            const freed = await request(app).patch(`${base}/${table.id}/status`).set('Authorization', cook).send({ status: 'libre' })
            expect(freed.status).toBe(200)
            expect(freed.body.occupiedAt).toBeNull()
        })

        it('should return 400 for an invalid status', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            const res = await request(app).patch(`${base}/${table.id}/status`).set('Authorization', waiter).send({ status: 'sucia' })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidTableStatusError')
        })
    })

    describe('client flow', () => {
        it('should list available tables publicly', async () => {
            await createTable({ number: 1, capacity: 2 })
            const four = await createTable({ number: 2, capacity: 4 })
            await createTable({ number: 3, capacity: 6, status: 'reservada' })

            const res = await request(app).get('/api/v1/public/restaurants/rest-1/tables?people=3')
            expect(res.status).toBe(200)
            expect(res.body.map((t: any) => t.id)).toEqual([four.id])

            const all = await request(app).get('/api/v1/public/restaurants/rest-1/tables')
            expect(all.body).toHaveLength(2)
        })

        it('should return 400 for an invalid people count and 404 for an unknown restaurant', async () => {
            const bad = await request(app).get('/api/v1/public/restaurants/rest-1/tables?people=0')
            expect(bad.status).toBe(400)
            expect(bad.body.error).toBe('InvalidPeopleCountError')

            const unknown = await request(app).get('/api/v1/public/restaurants/nope/tables')
            expect(unknown.status).toBe(404)
        })

        it('should occupy a table, create an order for it and show it to the employees', async () => {
            const table = await createTable({ number: 7, capacity: 4 })

            const occupied = await request(app).post(`${base}/${table.id}/occupy`).set('Authorization', client).send({ people: 3 })
            expect(occupied.status).toBe(200)
            expect(occupied.body.status).toBe('ocupada')

            const again = await request(app).post(`${base}/${table.id}/occupy`).set('Authorization', client).send({ people: 3 })
            expect(again.status).toBe(409)
            expect(again.body.error).toBe('TableNotAvailableError')

            const order = await request(app).post('/api/v1/orders').set('Authorization', client)
                .send({ restaurantId: 'rest-1', tableId: table.id, items: [{ dishId: 'dish-1', quantity: 1 }] })
            expect(order.status).toBe(201)
            expect(order.body.tableId).toBe(table.id)

            const tableOrders = await request(app).get(`${base}/${table.id}/orders`).set('Authorization', waiter)
            expect(tableOrders.status).toBe(200)
            expect(tableOrders.body).toHaveLength(1)
            expect(tableOrders.body[0]).toMatchObject({ id: order.body.id, tableNumber: 7 })
            expect(tableOrders.body[0].items[0].dishName).toBe('Pizza')

            const withOrders = await request(app).get(`${base}?include=orders`).set('Authorization', cook)
            expect(withOrders.status).toBe(200)
            expect(withOrders.body[0].orders).toEqual(tableOrders.body)

            const withoutOrders = await request(app).get(`${base}?include=nothing`).set('Authorization', cook)
            expect(withoutOrders.body[0]).not.toHaveProperty('orders')

            const detail = await request(app).get(`/api/v1/orders/${order.body.id}`).set('Authorization', client)
            expect(detail.body.tableNumber).toBe(7)

            await request(app).patch(`${base}/${table.id}/status`).set('Authorization', waiter).send({ status: 'libre' })
            const afterFree = await request(app).get(`${base}/${table.id}/orders`).set('Authorization', waiter)
            expect(afterFree.body).toEqual([])
        })

        it('should return 400 when people exceed the capacity', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            const res = await request(app).post(`${base}/${table.id}/occupy`).set('Authorization', client).send({ people: 3 })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('TableCapacityExceededError')
        })

        it('should reject orders for a table that is not ocupada', async () => {
            const table = await createTable({ number: 1, capacity: 2 })

            const notOccupied = await request(app).post('/api/v1/orders').set('Authorization', client)
                .send({ restaurantId: 'rest-1', tableId: table.id, items: [{ dishId: 'dish-1', quantity: 1 }] })
            expect(notOccupied.status).toBe(400)
            expect(notOccupied.body).toEqual({ error: 'The table is not occupied' })

            const unknown = await request(app).post('/api/v1/orders').set('Authorization', client)
                .send({ restaurantId: 'rest-1', tableId: 'nope', items: [{ dishId: 'dish-1', quantity: 1 }] })
            expect(unknown.status).toBe(400)
            expect(unknown.body).toEqual({ error: 'Table not found' })
        })
    })
})

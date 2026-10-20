import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { SqliteRestaurantRepository } from '@repositories/restaurant.repository.js'
import { SqliteOrderRepository } from '@repositories/order.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize, restrictToOwnRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableService = new TableService(
    new SqliteTableRepository(dbConfig),
    new SqliteRestaurantRepository(dbConfig),
    new SqliteOrderRepository(dbConfig)
)
const tableController = new TableController(tableService)

const MANAGERS = ['admin', 'manager']
const STAFF = ['admin', 'manager', 'camarero', 'cocinero']

const router = Router({ mergeParams: true })

router.use(authenticate, restrictToOwnRestaurant)

router.post('/', authorize(MANAGERS), tableController.create)
router.get('/', authorize(STAFF), tableController.getAll)
router.get('/:id', authorize(STAFF), tableController.getById)
router.put('/:id', authorize(MANAGERS), tableController.update)
router.delete('/:id', authorize(MANAGERS), tableController.delete)
router.patch('/:id/status', authorize(STAFF), tableController.updateStatus)
router.get('/:id/orders', authorize(STAFF), tableController.getOrders)
router.post('/:id/occupy', authorize(['cliente']), tableController.occupy)

export default router

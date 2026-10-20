import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.create(req.params.restaurantId as string, {
                number: req.body.number,
                capacity: req.body.capacity,
                description: req.body.description,
                status: req.body.status
            })
            res.status(201).json(table)
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.listByRestaurant(req.params.restaurantId as string, req.query.include === 'orders')
            res.status(200).json(tables)
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.getById(req.params.restaurantId as string, req.params.id as string)
            res.status(200).json(table)
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.update(req.params.restaurantId as string, req.params.id as string, {
                number: req.body.number,
                capacity: req.body.capacity,
                description: req.body.description,
                status: req.body.status
            })
            res.status(200).json(table)
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(req.params.restaurantId as string, req.params.id as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.updateStatus(req.params.restaurantId as string, req.params.id as string, req.body.status)
            res.status(200).json(table)
        } catch (error) {
            next(error)
        }
    }

    getOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const orders = await this.tableService.listOrders(req.params.restaurantId as string, req.params.id as string)
            res.status(200).json(orders)
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.listAvailable(req.params.restaurantId as string, req.query.people)
            res.status(200).json(tables)
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.occupy(req.params.restaurantId as string, req.params.id as string, req.body.people)
            res.status(200).json(table)
        } catch (error) {
            next(error)
        }
    }
}

import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { TableService } from '../services/table.service'
import type { Table, TableStatus, CreateTableDto, UpdateTableDto } from '../models/table.model'

const ERROR_MESSAGES: Record<string, string> = {
  DuplicatedTableNumberError: 'Ya existe una mesa con ese número en el restaurante.',
  InvalidTableNumberError: 'El número de mesa debe ser un entero mayor o igual que 1.',
  InvalidTableCapacityError: 'La capacidad debe ser un entero mayor o igual que 1.',
  InvalidTableStatusError: 'El estado de la mesa no es válido.',
  TableOccupiedError: 'No se puede eliminar una mesa ocupada.',
  TableNotFoundError: 'La mesa no existe.',
  RestaurantNotFoundError: 'El restaurante no existe.'
}

const byNumber = (a: Table, b: Table) => a.number - b.number

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly service = inject(TableService)

  private readonly _tables = signal<Table[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)

  readonly tables = this._tables.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadByRestaurant(restaurantId: string): Promise<void> {
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getAll(restaurantId))
      this._tables.set(data)
    } catch {
      this._error.set('No se pudieron cargar las mesas.')
    } finally {
      this._loading.set(false)
    }
  }

  getById(restaurantId: string, id: string): Promise<Table> {
    return firstValueFrom(this.service.getById(restaurantId, id))
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<void> {
    const table = await firstValueFrom(this.service.create(restaurantId, dto))
    this._tables.update(list => [...list, table].sort(byNumber))
  }

  async update(restaurantId: string, id: string, dto: UpdateTableDto): Promise<void> {
    const updated = await firstValueFrom(this.service.update(restaurantId, id, dto))
    this._tables.update(list => list.map(t => t.id === id ? updated : t).sort(byNumber))
  }

  async updateStatus(restaurantId: string, id: string, status: TableStatus): Promise<void> {
    const updated = await firstValueFrom(this.service.updateStatus(restaurantId, id, status))
    this._tables.update(list => list.map(t => t.id === id ? updated : t))
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    await firstValueFrom(this.service.delete(restaurantId, id))
    this._tables.update(list => list.filter(t => t.id !== id))
  }

  // Maps the API error code ({ error, message }) to a user-facing message in Spanish
  errorMessage(err: any, fallback: string): string {
    return ERROR_MESSAGES[err?.error?.error] ?? fallback
  }
}

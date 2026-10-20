import { Injectable, signal } from '@angular/core'
import { Table } from '../models/table.model'

const STORAGE_KEY = 'selected_tables'

function readStoredTables(): Record<string, Table> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

// Table occupied by the client in each restaurant, keyed by restaurantId.
// Persisted so a page reload does not leave the client without the table it already occupied.
@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly _tables = signal<Record<string, Table>>(readStoredTables())

  readonly tables = this._tables.asReadonly()

  tableFor(restaurantId: string | null): Table | null {
    return restaurantId ? this._tables()[restaurantId] ?? null : null
  }

  select(table: Table): void {
    this._tables.update(tables => ({ ...tables, [table.restaurantId]: table }))
    this.persist()
  }

  clear(restaurantId: string): void {
    this._tables.update(({ [restaurantId]: _, ...rest }) => rest)
    this.persist()
  }

  clearAll(): void {
    this._tables.set({})
    this.persist()
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tables()))
    } catch {
      // Storage unavailable: the selection lives only in memory
    }
  }
}

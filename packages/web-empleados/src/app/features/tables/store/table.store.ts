import { Injectable, inject, signal, computed } from '@angular/core';
import { TableStatus, TableWithOrders } from '../models/table.model';
import { TableService } from '../services/table.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<TableWithOrders[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _updatingId = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly updatingId = this._updatingId.asReadonly();

  readonly countByStatus = computed(() => {
    const counts: Record<TableStatus, number> = { libre: 0, ocupada: 0, reservada: 0 };
    for (const table of this._tables()) {
      counts[table.status]++;
    }
    return counts;
  });

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const tables = await firstValueFrom(this.tableService.getTablesWithOrders(restaurantId));
      this._tables.set(tables);
    } catch (err: any) {
      this._error.set(err.error?.message || 'Error al cargar mesas');
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(restaurantId: string, tableId: string, status: TableStatus): Promise<void> {
    this._updatingId.set(tableId);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.tableService.updateStatus(restaurantId, tableId, { status }));
      this._tables.update(tables =>
        tables.map(table => {
          if (table.id !== tableId) return table;
          // A new occupation starts with no orders; only an ocupada -> ocupada change keeps them
          const keepOrders = table.status === 'ocupada' && updated.status === 'ocupada';
          return { ...updated, orders: keepOrders ? table.orders : [] };
        })
      );
    } catch (err: any) {
      this._error.set(err.error?.message || 'Error al cambiar el estado de la mesa');
    } finally {
      this._updatingId.set(null);
    }
  }

  startPolling(restaurantId: string): void {
    this.stopPolling();
    this.loadTables(restaurantId);
    this.pollingInterval = setInterval(() => {
      this.loadTables(restaurantId);
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

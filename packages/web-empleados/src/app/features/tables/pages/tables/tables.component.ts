import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { TABLE_STATUSES, TableStatus, TableWithOrders } from '../../models/table.model';
import { Order } from '../../../orders/models/order.model';

type TableFilter = TableStatus | 'todas';

@Component({
  selector: 'app-tables',
  standalone: true,
  imports: [DatePipe, LucideAngularModule],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  readonly statuses = TABLE_STATUSES;
  readonly filter = signal<TableFilter>('todas');

  readonly filteredTables = computed(() => {
    const filter = this.filter();
    const tables = this.tableStore.tables();
    return filter === 'todas' ? tables : tables.filter(table => table.status === filter);
  });

  ngOnInit(): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
  }

  setFilter(filter: TableFilter): void {
    this.filter.set(filter);
  }

  changeStatus(table: TableWithOrders, status: TableStatus): void {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (!restaurantId || table.status === status) return;
    this.tableStore.updateStatus(restaurantId, table.id, status);
  }

  deliveredCount(order: Order): number {
    return order.items.filter(item => item.status === 'entregado').length;
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }
}

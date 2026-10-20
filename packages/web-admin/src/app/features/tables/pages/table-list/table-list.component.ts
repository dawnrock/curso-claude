import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import { TABLE_STATUSES, TABLE_STATUS_LABELS } from '../../models/table.model'
import type { Table, TableStatus } from '../../models/table.model'

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit {
  readonly store = inject(TableStore)
  private readonly route = inject(ActivatedRoute)
  private readonly destroyRef = inject(DestroyRef)
  restaurantId = ''

  readonly statuses = TABLE_STATUSES
  readonly statusLabels = TABLE_STATUS_LABELS
  actionError = signal<string | null>(null)

  ngOnInit(): void {
    // The router reuses this component when only :restaurantId changes, so react to param changes
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? ''
        this.actionError.set(null)
        if (this.restaurantId) {
          this.store.loadByRestaurant(this.restaurantId)
        }
      })
  }

  async onStatusChange(table: Table, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement
    const status = select.value as TableStatus
    this.actionError.set(null)
    try {
      await this.store.updateStatus(this.restaurantId, table.id, status)
    } catch (err) {
      select.value = table.status
      this.actionError.set(this.store.errorMessage(err, 'Error al cambiar el estado de la mesa.'))
    }
  }

  async onDelete(table: Table): Promise<void> {
    if (!this.restaurantId) return
    if (confirm(`¿Estás seguro de eliminar la mesa ${table.number}?`)) {
      this.actionError.set(null)
      try {
        await this.store.delete(this.restaurantId, table.id)
      } catch (err) {
        this.actionError.set(this.store.errorMessage(err, 'Error al eliminar la mesa.'))
      }
    }
  }
}

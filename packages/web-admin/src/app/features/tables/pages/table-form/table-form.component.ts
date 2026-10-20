import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import { TABLE_STATUSES, TABLE_STATUS_LABELS } from '../../models/table.model'
import type { CreateTableDto } from '../../models/table.model'

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId: string = ''
  loading = signal(false)
  error = signal<string | null>(null)

  readonly statuses = TABLE_STATUSES
  readonly statusLabels = TABLE_STATUS_LABELS

  form: CreateTableDto = {
    number: 1,
    description: null,
    capacity: 4,
    status: 'libre'
  }

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    if (!this.tableId) return
    this.loading.set(true)
    try {
      const table = await this.store.getById(this.restaurantId, this.tableId)
      this.form = {
        number: table.number,
        description: table.description,
        capacity: table.capacity,
        status: table.status
      }
    } catch (err) {
      this.error.set(this.store.errorMessage(err, 'No se pudo cargar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }

  private validate(): string | null {
    if (!Number.isInteger(this.form.number) || this.form.number < 1) {
      return 'El número de mesa debe ser un entero mayor o igual que 1.'
    }
    if (!Number.isInteger(this.form.capacity) || this.form.capacity < 1) {
      return 'La capacidad debe ser un entero mayor o igual que 1.'
    }
    return null
  }

  async onSubmit(): Promise<void> {
    const validationError = this.validate()
    this.error.set(validationError)
    if (validationError) return

    const dto: CreateTableDto = {
      ...this.form,
      description: this.form.description?.trim() || null
    }

    this.loading.set(true)
    try {
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, dto)
      } else {
        await this.store.create(this.restaurantId, dto)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err) {
      this.error.set(this.store.errorMessage(err, 'Error al guardar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }
}

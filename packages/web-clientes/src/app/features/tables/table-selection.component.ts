import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { LucideAngularModule } from 'lucide-angular'
import { RestaurantService } from '../../core/services/restaurant.service'
import { TableService } from '../../core/services/table.service'
import { TableStore } from '../../core/store/table.store'
import { Restaurant } from '../../core/models/restaurant.model'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Cargando...' }}</h1>
          <p>Indica cuántas personas sois y elige una mesa libre</p>
        </div>
      </div>

      <div class="people-step card">
        <h3>¿Cuántas personas sois?</h3>
        <div class="people-controls">
          <div class="quantity-selector">
            <button class="qty-btn" (click)="decrementPeople()" [disabled]="people() <= 1">-</button>
            <span>{{ people() }}</span>
            <button class="qty-btn" (click)="incrementPeople()">+</button>
          </div>
          <button class="btn btn-primary" (click)="search()" [disabled]="loading()">
            Ver mesas disponibles
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (searched()) {
        @if (tables().length === 0) {
          <div class="empty-state card">
            <p>No hay mesas libres para {{ people() }} {{ people() === 1 ? 'persona' : 'personas' }}</p>
          </div>
        } @else {
          <div class="table-grid">
            @for (table of tables(); track table.id) {
              <button class="table-card card" [class.selected]="selectedId() === table.id" (click)="selectedId.set(table.id)">
                <span class="table-number">Mesa {{ table.number }}</span>
                <span class="table-capacity">
                  <lucide-icon name="users" [size]="16"></lucide-icon>
                  Hasta {{ table.capacity }} {{ table.capacity === 1 ? 'persona' : 'personas' }}
                </span>
                @if (table.description) {
                  <span class="table-description">{{ table.description }}</span>
                }
              </button>
            }
          </div>

          <div class="actions-bar">
            <button class="btn btn-primary" [disabled]="!selectedId() || occupying()" (click)="continue()">
              @if (occupying()) {
                Reservando mesa...
              } @else {
                Continuar
              }
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .page-header p {
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .people-step {
      margin-bottom: 24px;
    }
    .people-step h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .people-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-input);
      border-radius: var(--radius-sm);
      padding: 4px;
    }
    .quantity-selector span {
      min-width: 24px;
      text-align: center;
      font-weight: 600;
    }
    .qty-btn {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      background: var(--bg-hover);
      color: var(--text-primary);
      font-weight: 600;
    }
    .qty-btn:hover:not(:disabled) {
      background: var(--green-glow);
      color: var(--green-light);
    }
    .qty-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .alert-error {
      margin-bottom: 16px;
    }
    .table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 20px;
      text-align: left;
      color: var(--text-primary);
      cursor: pointer;
      transition: all var(--transition);
    }
    .table-card:hover {
      transform: translateY(-2px);
      border-color: var(--green-medium);
    }
    .table-card.selected {
      border-color: var(--green-light);
      background: var(--green-glow);
    }
    .table-number {
      font-size: 18px;
      font-weight: 600;
    }
    .table-capacity {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-secondary);
      font-size: 14px;
    }
    .table-description {
      color: var(--text-muted);
      font-size: 13px;
    }
    .actions-bar {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly restaurantService = inject(RestaurantService)
  private readonly tableService = inject(TableService)
  private readonly tableStore = inject(TableStore)

  readonly restaurant = signal<Restaurant | null>(null)
  readonly people = signal(2)
  readonly tables = signal<Table[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly searched = signal(false)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)

  private restaurantId = ''

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!

    if (this.tableStore.tableFor(this.restaurantId)) {
      this.goToMenu()
      return
    }

    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (restaurant) => this.restaurant.set(restaurant),
      error: () => this.error.set('Error al cargar el restaurante')
    })
  }

  incrementPeople(): void {
    this.people.update(p => p + 1)
    this.resetResults()
  }

  decrementPeople(): void {
    if (this.people() > 1) {
      this.people.update(p => p - 1)
      this.resetResults()
    }
  }

  search(): void {
    this.error.set(null)
    this.loadTables()
  }

  private loadTables(): void {
    this.loading.set(true)
    this.selectedId.set(null)

    this.tableService.getAvailable(this.restaurantId, this.people()).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searched.set(true)
        this.loading.set(false)
      },
      error: () => {
        this.error.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }

  continue(): void {
    const tableId = this.selectedId()
    if (!tableId) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, tableId, this.people()).subscribe({
      next: (table) => {
        this.tableStore.select(table)
        this.goToMenu()
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        if (err.status === 409 || err.status === 404) {
          this.error.set('Esa mesa ya no está disponible. Elige otra.')
          this.loadTables()
        } else if (err.error?.error === 'TableCapacityExceededError') {
          this.error.set('La mesa no tiene capacidad para tantas personas. Elige otra.')
          this.loadTables()
        } else {
          this.error.set('Error al reservar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private resetResults(): void {
    this.searched.set(false)
    this.tables.set([])
    this.selectedId.set(null)
    this.error.set(null)
  }

  private goToMenu(): void {
    this.router.navigate(['/restaurants', this.restaurantId], { replaceUrl: true })
  }
}
